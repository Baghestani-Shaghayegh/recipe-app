/**
 * Turns a file someone picked into recipe text for the recipe reader (parseRecipeText).
 *
 * Handles PDFs, Word (.docx), Notion exports (Markdown or HTML, also inside the .zip Notion
 * downloads), web pages saved as HTML, and plain text. All in JavaScript, so it runs the same
 * on phones and the web.
 */
import { strFromU8, unzipSync } from 'fflate';

import { cleanOcrText } from './ocr';
import { PdfProblem, pdfLines } from './pdf-text';

export class FileProblem extends Error {}

export const MAX_FILE_BYTES = 30 * 1024 * 1024;

type Kind = 'pdf' | 'docx' | 'zip' | 'html' | 'markdown' | 'text';

function kindOf(name: string, mimeType: string | undefined, bytes: Uint8Array): Kind | undefined {
  const ext = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase();
  if (ext === 'pdf' || mimeType === 'application/pdf') return 'pdf';
  if (ext === 'docx' || mimeType?.includes('wordprocessingml')) return 'docx';
  if (ext === 'zip' || mimeType === 'application/zip') return 'zip';
  if (ext === 'html' || ext === 'htm' || mimeType === 'text/html') return 'html';
  if (ext === 'md' || ext === 'markdown' || mimeType === 'text/markdown') return 'markdown';
  if (ext === 'txt' || mimeType?.startsWith('text/')) return 'text';
  // No useful name or type: look at the first bytes.
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)
    return 'pdf';
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return 'zip';
  return undefined;
}

/** The recipe text in a file. Throws FileProblem with a message for the person when it can't. */
export function textFromFile(file: { name: string; mimeType?: string; bytes: Uint8Array }): string {
  const { name, bytes } = file;
  if (bytes.length > MAX_FILE_BYTES) throw new FileProblem('That file is too big to import.');
  const kind = kindOf(name, file.mimeType, bytes);
  let text: string;
  switch (kind) {
    case 'pdf':
      try {
        text = cleanOcrText(pdfLines(bytes));
      } catch (e) {
        throw new FileProblem(e instanceof PdfProblem ? e.message : 'Couldn’t read that PDF.');
      }
      if (!text.trim()) {
        throw new FileProblem(
          'That PDF is a scanned picture, so there’s no text in it to read. Take a screenshot of it and add it as a photo instead.',
        );
      }
      return text;
    case 'docx':
      text = docxText(bytes);
      break;
    case 'zip':
      text = zipText(bytes);
      break;
    case 'html':
      text = htmlText(decodeText(bytes));
      break;
    case 'markdown':
      text = markdownText(decodeText(bytes));
      break;
    case 'text':
      text = decodeText(bytes);
      break;
    default:
      throw new FileProblem(
        'That kind of file can’t be imported. Use a PDF, a Word file, a Notion export or a text file.',
      );
  }
  text = tidy(text);
  if (!text) throw new FileProblem('That file is empty.');
  return text;
}

/** UTF-8, or UTF-16 when the file starts with its byte-order mark. */
export function decodeText(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    let s = '';
    for (let i = 2; i + 1 < bytes.length; i += 2)
      s += String.fromCharCode(bytes[i] | (bytes[i + 1] << 8));
    return s;
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    let s = '';
    for (let i = 2; i + 1 < bytes.length; i += 2)
      s += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
    return s;
  }
  return strFromU8(bytes).replace(/^﻿/, '');
}

function unzip(bytes: Uint8Array): Record<string, Uint8Array> {
  try {
    return unzipSync(bytes);
  } catch {
    throw new FileProblem('That file looks damaged, so it can’t be opened.');
  }
}

// ---------- Word ----------

export function docxText(bytes: Uint8Array): string {
  const files = unzip(bytes);
  const doc = files['word/document.xml'];
  if (!doc) throw new FileProblem('That doesn’t look like a Word file.');
  const xml = strFromU8(doc);
  const lines: string[] = [];
  for (const [para] of xml.matchAll(/<w:p[ >][\s\S]*?<\/w:p>|<w:p\/>/g)) {
    let line = '';
    for (const [tag, text] of para.matchAll(
      /<w:t(?: [^>]*)?>([\s\S]*?)<\/w:t>|<w:(tab|br|cr)\/>|<w:t\/>/g,
    )) {
      if (tag.startsWith('<w:t')) line += decodeEntities(text ?? '');
      else if (tag === '<w:br/>' || tag === '<w:cr/>') line += '\n';
      else line += ' ';
    }
    // Word's automatic numbering isn't in the text; keep list items looking like a list.
    if (/<w:numPr>/.test(para) && line.trim()) line = `- ${line}`;
    lines.push(line);
  }
  return lines.join('\n');
}

// ---------- Notion exports and other zips ----------

const TEXT_FILE = /\.(md|markdown|html?|txt)$/i;

export function zipText(bytes: Uint8Array, depth = 0): string {
  const files = unzip(bytes);
  if (files['word/document.xml']) return docxText(bytes);
  const names = Object.keys(files).filter((n) => !n.startsWith('__MACOSX/') && !n.endsWith('/'));
  // Notion puts big exports in a zip inside the zip.
  const inner = names.find((n) => /\.zip$/i.test(n));
  const pages = names.filter((n) => TEXT_FILE.test(n) || /\.pdf$/i.test(n) || /\.docx$/i.test(n));
  if (!pages.length && inner && depth < 2) return zipText(files[inner], depth + 1);
  if (!pages.length) throw new FileProblem('There’s no recipe page in that zip file.');
  // The top-level page: the one with the shortest path.
  const [page] = pages.sort(
    (a, b) => a.split('/').length - b.split('/').length || a.length - b.length,
  );
  return textFromFile({ name: page, bytes: files[page] });
}

// ---------- HTML ----------

export function htmlText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(head|style|script|noscript|svg)[\s\S]*?<\/\1>/gi, '')
      // Line breaks in the HTML source are just spaces; the tags below decide the lines.
      .replace(/\s+/g, ' ')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<li\b[^>]*>/gi, '\n- ')
      .replace(/<\/li>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(
        /<\/?(p|div|h[1-6]|ul|ol|li|tr|table|section|article|header|footer|blockquote|figure|pre)\b[^>]*>/gi,
        '\n',
      )
      .replace(/<(td|th)\b[^>]*>/gi, ' ')
      .replace(/<[^>]+>/g, ''),
  );
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  deg: '°',
  frac12: '½',
  frac14: '¼',
  frac34: '¾',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  bull: '•',
  times: '×',
  eacute: 'é',
  egrave: 'è',
};

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code =
        e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return NAMED_ENTITIES[e.toLowerCase()] ?? m;
  });
}

// ---------- Markdown (Notion's Markdown export) ----------

export function markdownText(md: string): string {
  return md
    .split('\n')
    .map((line) =>
      line
        .replace(/^\s{0,3}#{1,6}\s+/, '') // headings
        .replace(/^(\s*)[-*+]\s+\[[ xX]\]\s+/, '$1- ') // to-do boxes
        .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // images
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // links keep their text
        .replace(/(\*\*|__)(.+?)\1/g, '$2') // bold
        .replace(/(^|[^*\w])[*_]([^*_]+)[*_](?=[^*\w]|$)/g, '$1$2') // italics
        .replace(/`([^`]+)`/g, '$1')
        .replace(/^\s*>\s?/, '') // quotes and Notion callouts
        .replace(/^\s*\|(.*)\|\s*$/, (_, row: string) =>
          /^[\s|:-]+$/.test(row)
            ? ''
            : row
                .split('|')
                .map((c) => c.trim())
                .filter(Boolean)
                .join(' '),
        ),
    )
    .join('\n');
}

function tidy(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t ]+/g, ' ')
    .split('\n')
    .map((l) => l.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
