/**
 * Reads the text out of a PDF, in plain JavaScript, so it works the same on phones and the web.
 *
 * It handles the PDFs people actually save recipes as: printed from a browser, Notion or Google
 * Docs, exported from Word or Pages, or made by a recipe site. Those keep the text as text.
 * A scanned page is only a picture, so there is no text to find; the caller says so.
 *
 * What it covers: compressed streams and object streams, fonts with a ToUnicode map (how most
 * PDFs store their letters today), the standard Latin encodings for older ones, text inside
 * form XObjects, and spaces/line breaks rebuilt from where the text sits on the page.
 */
import { unzlibSync, inflateSync } from 'fflate';

export class PdfProblem extends Error {}

type Name = { name: string };
type Ref = { ref: number };
// A type-only marker so TypeScript can tell a dictionary from a name or a reference.
declare const DICT: unique symbol;
type PdfDict = { [key: string]: PdfValue; [DICT]: true };
const EMPTY = {} as PdfDict;
type PdfValue = number | boolean | null | string | Name | Ref | Uint8Array | PdfValue[] | PdfDict;
type PdfObject = { value: PdfValue; stream?: Uint8Array };

const isName = (v: unknown): v is Name => typeof v === 'object' && v !== null && 'name' in v;
const isRef = (v: unknown): v is Ref => typeof v === 'object' && v !== null && 'ref' in v;
const isDict = (v: unknown): v is PdfDict =>
  typeof v === 'object' &&
  v !== null &&
  !Array.isArray(v) &&
  !(v instanceof Uint8Array) &&
  !isName(v) &&
  !isRef(v);

// ---------- Tokenizer (shared by the file body and page content) ----------

const WHITESPACE = new Set([0, 9, 10, 12, 13, 32]);
const DELIMITERS = new Set([40, 41, 60, 62, 91, 93, 123, 125, 47, 37]); // ( ) < > [ ] { } / %

class Lexer {
  readonly b: Uint8Array;
  readonly end: number;
  pos: number;
  constructor(b: Uint8Array, start = 0, end = b.length) {
    this.b = b;
    this.end = end;
    this.pos = start;
  }

  skipSpace() {
    const { b } = this;
    while (this.pos < this.end) {
      const ch = b[this.pos];
      if (WHITESPACE.has(ch)) this.pos++;
      else if (ch === 37) {
        while (this.pos < this.end && b[this.pos] !== 10 && b[this.pos] !== 13) this.pos++;
      } else break;
    }
  }

  /** The next value or operator. Operators come back as { op }. Undefined at the end. */
  next(): PdfValue | { op: string } | undefined {
    this.skipSpace();
    const { b } = this;
    if (this.pos >= this.end) return undefined;
    const ch = b[this.pos];

    if (ch === 47) {
      // /Name, with #xx escapes
      let s = '';
      this.pos++;
      while (this.pos < this.end && !WHITESPACE.has(b[this.pos]) && !DELIMITERS.has(b[this.pos])) {
        if (b[this.pos] === 35 && this.pos + 2 < this.end) {
          s += String.fromCharCode(
            parseInt(String.fromCharCode(b[this.pos + 1], b[this.pos + 2]), 16),
          );
          this.pos += 3;
        } else s += String.fromCharCode(b[this.pos++]);
      }
      return { name: s };
    }
    if (ch === 40) return this.literalString();
    if (ch === 60) {
      if (b[this.pos + 1] === 60) {
        this.pos += 2;
        return this.dict();
      }
      return this.hexString();
    }
    if (ch === 91) {
      this.pos++;
      const arr: PdfValue[] = [];
      for (;;) {
        this.skipSpace();
        if (this.pos >= this.end) return arr;
        if (b[this.pos] === 93) {
          this.pos++;
          return arr;
        }
        const v = this.value();
        if (v === undefined) return arr;
        arr.push(v);
      }
    }
    if (ch === 93 || ch === 62 || ch === 41 || ch === 123 || ch === 125) {
      this.pos++;
      return { op: String.fromCharCode(ch) };
    }

    // A number or a bare word (operator, true/false/null, obj/R/stream keywords).
    const start = this.pos;
    while (this.pos < this.end && !WHITESPACE.has(b[this.pos]) && !DELIMITERS.has(b[this.pos])) {
      this.pos++;
    }
    const word = latin1(b, start, this.pos);
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(word)) return parseFloat(word);
    if (word === 'true') return true;
    if (word === 'false') return false;
    if (word === 'null') return null;
    return { op: word };
  }

  /** A value, turning "12 0 R" into a reference. Operators are skipped over. */
  value(): PdfValue | undefined {
    const v = this.next();
    if (v === undefined) return undefined;
    if (typeof v === 'number' && Number.isInteger(v)) {
      const save = this.pos;
      const gen = this.next();
      if (typeof gen === 'number' && Number.isInteger(gen)) {
        const r = this.next();
        if (isOp(r, 'R')) return { ref: v };
      }
      this.pos = save;
      return v;
    }
    if (isOpToken(v)) return v.op === '>' || v.op === ']' ? undefined : this.value();
    return v;
  }

  private dict(): PdfDict {
    const d = {} as PdfDict;
    for (;;) {
      this.skipSpace();
      if (this.pos >= this.end) return d;
      if (this.b[this.pos] === 62 && this.b[this.pos + 1] === 62) {
        this.pos += 2;
        return d;
      }
      const key = this.next();
      if (!isName(key)) {
        if (key === undefined) return d;
        continue;
      }
      const v = this.value();
      if (v === undefined) return d;
      d[key.name] = v;
    }
  }

  private literalString(): Uint8Array {
    const { b } = this;
    const out: number[] = [];
    let depth = 1;
    this.pos++;
    while (this.pos < this.end) {
      const ch = b[this.pos++];
      if (ch === 92) {
        const e = b[this.pos++];
        if (e === 110) out.push(10);
        else if (e === 114) out.push(13);
        else if (e === 116) out.push(9);
        else if (e === 98) out.push(8);
        else if (e === 102) out.push(12);
        else if (e >= 48 && e <= 55) {
          let code = e - 48;
          for (let i = 0; i < 2 && b[this.pos] >= 48 && b[this.pos] <= 55; i++) {
            code = code * 8 + (b[this.pos++] - 48);
          }
          out.push(code & 255);
        } else if (e === 13) {
          if (b[this.pos] === 10) this.pos++;
        } else if (e !== 10) out.push(e);
      } else if (ch === 40) {
        depth++;
        out.push(ch);
      } else if (ch === 41) {
        if (--depth === 0) break;
        out.push(ch);
      } else out.push(ch);
    }
    return Uint8Array.from(out);
  }

  private hexString(): Uint8Array {
    const { b } = this;
    this.pos++;
    let hex = '';
    while (this.pos < this.end && b[this.pos] !== 62) {
      const ch = b[this.pos++];
      if (!WHITESPACE.has(ch)) hex += String.fromCharCode(ch);
    }
    this.pos++;
    if (hex.length % 2) hex += '0';
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16) || 0;
    return out;
  }
}

const isOpToken = (v: unknown): v is { op: string } =>
  typeof v === 'object' && v !== null && 'op' in v;
const isOp = (v: unknown, op: string) => isOpToken(v) && v.op === op;

function latin1(b: Uint8Array, start = 0, end = b.length): string {
  let s = '';
  for (let i = start; i < end; i += 8192) {
    s += String.fromCharCode(...b.subarray(i, Math.min(end, i + 8192)));
  }
  return s;
}

// ---------- The file: objects, streams, pages ----------

class PdfFile {
  private objects = new Map<number, PdfObject>();
  private decoded = new WeakMap<PdfObject, Uint8Array>();

  constructor(b: Uint8Array) {
    const text = latin1(b);
    if (!text.startsWith('%PDF')) throw new PdfProblem('That file isn’t a PDF.');
    if (/\/Encrypt\s*(\d+\s+\d+\s+R|<<)/.test(text)) {
      throw new PdfProblem('That PDF is locked with a password, so it can’t be read.');
    }
    // Every "n 0 obj" in the file. Later copies (from edits saved onto the end) win.
    const re = /(\d+)\s+(\d+)\s+obj\b/g;
    for (let m = re.exec(text); m; m = re.exec(text)) {
      const num = Number(m[1]);
      const lex = new Lexer(b, m.index + m[0].length);
      const value = lex.value();
      if (value === undefined) continue;
      const obj: PdfObject = { value };
      lex.skipSpace();
      if (isDict(value) && text.startsWith('stream', lex.pos)) {
        let start = lex.pos + 6;
        if (b[start] === 13) start++;
        if (b[start] === 10) start++;
        const len = typeof value.Length === 'number' ? value.Length : -1;
        const endAt =
          len >= 0 && /^\s*endstream/.test(text.slice(start + len, start + len + 20))
            ? start + len
            : text.indexOf('endstream', start);
        if (endAt < 0) continue;
        obj.stream = b.subarray(start, endAt);
        re.lastIndex = endAt;
      }
      this.objects.set(num, obj);
    }
    this.unpackObjectStreams();
  }

  /** Objects packed inside compressed object streams (common in PDFs from Word). */
  private unpackObjectStreams() {
    for (const obj of [...this.objects.values()]) {
      const d = obj.value;
      if (!isDict(d) || !isName(d.Type) || d.Type.name !== 'ObjStm' || !obj.stream) continue;
      const data = this.streamData(obj);
      const n = this.num(d.N);
      const first = this.num(d.First);
      const head = new Lexer(data, 0, first);
      const pairs: [number, number][] = [];
      for (let i = 0; i < n; i++) {
        const num = head.next();
        const off = head.next();
        if (typeof num !== 'number' || typeof off !== 'number') break;
        pairs.push([num, off]);
      }
      for (const [num, off] of pairs) {
        if (this.objects.has(num)) continue;
        const value = new Lexer(data, first + off).value();
        if (value !== undefined) this.objects.set(num, { value });
      }
    }
  }

  resolve(v: PdfValue | undefined, depth = 0): PdfValue | undefined {
    if (isRef(v) && depth < 16) return this.resolve(this.objects.get(v.ref)?.value, depth + 1);
    return v;
  }

  dict(v: PdfValue | undefined): PdfDict | undefined {
    const r = this.resolve(v);
    return isDict(r) ? r : undefined;
  }

  num(v: PdfValue | undefined): number {
    const r = this.resolve(v);
    return typeof r === 'number' ? r : 0;
  }

  objectFor(v: PdfValue | undefined): PdfObject | undefined {
    return isRef(v) ? this.objects.get(v.ref) : undefined;
  }

  /** A stream's bytes with its compression undone. */
  streamData(obj: PdfObject): Uint8Array {
    const cached = this.decoded.get(obj);
    if (cached) return cached;
    let data = obj.stream ?? new Uint8Array();
    const d = isDict(obj.value) ? obj.value : EMPTY;
    const f = this.resolve(d.Filter);
    const filters = (Array.isArray(f) ? f : f ? [f] : []).map((x) => (isName(x) ? x.name : ''));
    for (const filter of filters) {
      if (filter === 'FlateDecode' || filter === 'Fl') data = inflate(data);
      else if (filter === 'ASCIIHexDecode' || filter === 'AHx') data = asciiHex(data);
      else if (filter === 'ASCII85Decode' || filter === 'A85') data = ascii85(data);
      else break; // Images and other filters hold no text.
    }
    this.decoded.set(obj, data);
    return data;
  }

  /** Pages in reading order, each with the resources it inherits. */
  pages(): { page: PdfDict; resources: PdfDict }[] {
    const out: { page: PdfDict; resources: PdfDict }[] = [];
    const seen = new Set<PdfDict>();
    const walk = (node: PdfDict | undefined, inherited: PdfDict, depth: number) => {
      if (!node || seen.has(node) || depth > 32) return;
      seen.add(node);
      const resources = this.dict(node.Resources) ?? inherited;
      const kids = this.resolve(node.Kids);
      if (Array.isArray(kids)) for (const k of kids) walk(this.dict(k), resources, depth + 1);
      else out.push({ page: node, resources });
    };
    for (const obj of this.objects.values()) {
      const d = obj.value;
      if (isDict(d) && isName(d.Type) && d.Type.name === 'Catalog') {
        walk(this.dict(d.Pages), EMPTY, 0);
        break;
      }
    }
    if (!out.length) {
      // No page tree found: fall back to every page object in file order.
      for (const obj of this.objects.values()) {
        const d = obj.value;
        if (isDict(d) && isName(d.Type) && d.Type.name === 'Page') {
          out.push({ page: d, resources: this.dict(d.Resources) ?? EMPTY });
        }
      }
    }
    return out;
  }

  pageContent(page: PdfDict): Uint8Array {
    const c = this.resolve(page.Contents);
    const parts = Array.isArray(c) ? c : [page.Contents];
    const chunks: Uint8Array[] = [];
    for (const p of parts) {
      const obj = this.objectFor(p as PdfValue);
      if (obj?.stream) chunks.push(this.streamData(obj), Uint8Array.of(10));
    }
    return concat(chunks);
  }
}

function inflate(data: Uint8Array): Uint8Array {
  try {
    return unzlibSync(data);
  } catch {
    try {
      return inflateSync(data);
    } catch {
      return new Uint8Array();
    }
  }
}

function asciiHex(data: Uint8Array): Uint8Array {
  const hex = latin1(data).replace(/[^0-9a-fA-F]/g, '');
  const out = new Uint8Array(Math.floor(hex.length / 2));
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function ascii85(data: Uint8Array): Uint8Array {
  const s = latin1(data).replace(/\s/g, '').replace(/^<~/, '').replace(/~>.*$/, '');
  const out: number[] = [];
  let group: number[] = [];
  const flush = (n: number) => {
    while (group.length < 5) group.push(84);
    let v = 0;
    for (const c of group) v = v * 85 + c;
    const bytes = [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];
    out.push(...bytes.slice(0, n));
    group = [];
  };
  for (const ch of s) {
    if (ch === 'z' && !group.length) out.push(0, 0, 0, 0);
    else {
      group.push(ch.charCodeAt(0) - 33);
      if (group.length === 5) flush(4);
    }
  }
  if (group.length) flush(group.length - 1);
  return Uint8Array.from(out);
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

// ---------- Fonts: turning character codes into letters ----------

type FontDecoder = { decode: (bytes: Uint8Array) => string; spaceCode?: boolean };

// Windows code page 1252 differs from Latin-1 only in 0x80–0x9F.
const WIN_ANSI_HIGH: Record<number, string> = {
  0x80: '€',
  0x82: '‚',
  0x83: 'ƒ',
  0x84: '„',
  0x85: '…',
  0x86: '†',
  0x87: '‡',
  0x88: 'ˆ',
  0x89: '‰',
  0x8a: 'Š',
  0x8b: '‹',
  0x8c: 'Œ',
  0x8e: 'Ž',
  0x91: '‘',
  0x92: '’',
  0x93: '“',
  0x94: '”',
  0x95: '•',
  0x96: '–',
  0x97: '—',
  0x98: '˜',
  0x99: '™',
  0x9a: 'š',
  0x9b: '›',
  0x9c: 'œ',
  0x9e: 'ž',
  0x9f: 'Ÿ',
};

// Glyph names a font's /Differences list may use, for the letters recipes need.
const GLYPH_NAMES: Record<string, string> = {
  space: ' ',
  quoteright: '’',
  quoteleft: '‘',
  quotedblleft: '“',
  quotedblright: '”',
  quotesingle: "'",
  bullet: '•',
  endash: '–',
  emdash: '—',
  hyphen: '-',
  minus: '-',
  degree: '°',
  fi: 'fi',
  fl: 'fl',
  ellipsis: '…',
  onehalf: '½',
  onequarter: '¼',
  threequarters: '¾',
  fraction: '⁄',
  multiply: '×',
  periodcentered: '·',
  copyright: '©',
  registered: '®',
  trademark: '™',
  eacute: 'é',
  egrave: 'è',
  ecircumflex: 'ê',
  agrave: 'à',
  aacute: 'á',
  ccedilla: 'ç',
  iacute: 'í',
  oacute: 'ó',
  uacute: 'ú',
  ntilde: 'ñ',
  udieresis: 'ü',
  odieresis: 'ö',
  adieresis: 'ä',
  germandbls: 'ß',
  period: '.',
  comma: ',',
  colon: ':',
  semicolon: ';',
  parenleft: '(',
  parenright: ')',
  slash: '/',
  ampersand: '&',
  percent: '%',
  plus: '+',
  equal: '=',
  exclam: '!',
  question: '?',
  numbersign: '#',
  zero: '0',
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
};

function glyphName(name: string): string | undefined {
  if (GLYPH_NAMES[name]) return GLYPH_NAMES[name];
  if (/^[A-Za-z]$/.test(name)) return name;
  const uni = /^uni([0-9A-Fa-f]{4})$/.exec(name) ?? /^u([0-9A-Fa-f]{4,6})$/.exec(name);
  return uni ? String.fromCodePoint(parseInt(uni[1], 16)) : undefined;
}

function utf16be(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i + 1 < bytes.length; i += 2)
    s += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
  return s;
}

const bytesToCode = (b: Uint8Array) => b.reduce((n, x) => n * 256 + x, 0);

type CodeRange = { bytes: number; lo: number; hi: number };

/** Reads a ToUnicode CMap: which character codes mean which letters. */
function parseToUnicode(data: Uint8Array): { map: Map<number, string>; ranges: CodeRange[] } {
  const map = new Map<number, string>();
  const ranges: CodeRange[] = [];
  const lex = new Lexer(data);
  const stack: PdfValue[] = [];
  for (let t = lex.next(); t !== undefined; t = lex.next()) {
    if (!isOpToken(t)) {
      stack.push(t);
      continue;
    }
    if (t.op === 'endcodespacerange') {
      for (let i = 0; i + 1 < stack.length; i += 2) {
        const lo = stack[i];
        const hi = stack[i + 1];
        if (lo instanceof Uint8Array && hi instanceof Uint8Array) {
          ranges.push({ bytes: lo.length, lo: bytesToCode(lo), hi: bytesToCode(hi) });
        }
      }
    } else if (t.op === 'endbfchar') {
      for (let i = 0; i + 1 < stack.length; i += 2) {
        const src = stack[i];
        const dst = stack[i + 1];
        if (src instanceof Uint8Array && dst instanceof Uint8Array)
          map.set(bytesToCode(src), utf16be(dst));
      }
    } else if (t.op === 'endbfrange') {
      for (let i = 0; i + 2 < stack.length; i += 3) {
        const [lo, hi, dst] = [stack[i], stack[i + 1], stack[i + 2]];
        if (!(lo instanceof Uint8Array) || !(hi instanceof Uint8Array)) continue;
        const from = bytesToCode(lo);
        const to = Math.min(bytesToCode(hi), from + 0xffff);
        if (dst instanceof Uint8Array) {
          const base = utf16be(dst);
          const last = base.charCodeAt(base.length - 1);
          for (let c = from; c <= to; c++) {
            map.set(c, base.slice(0, -1) + String.fromCharCode(last + (c - from)));
          }
        } else if (Array.isArray(dst)) {
          dst.forEach((d, k) => {
            if (d instanceof Uint8Array && from + k <= to) map.set(from + k, utf16be(d));
          });
        }
      }
    }
    if (t.op.startsWith('end') || t.op.startsWith('begin')) stack.length = 0;
  }
  return { map, ranges };
}

function fontDecoder(pdf: PdfFile, font: PdfDict | undefined): FontDecoder {
  if (!font) return { decode: (b) => latin1(b) };
  const twoByte = isName(font.Subtype) && font.Subtype.name === 'Type0';
  const tuObj = pdf.objectFor(font.ToUnicode);
  const toUnicode = tuObj?.stream ? parseToUnicode(pdf.streamData(tuObj)) : undefined;

  // The font's own encoding, for codes the ToUnicode map leaves out (or when there is none).
  const table: Record<number, string> = {};
  const enc = pdf.resolve(font.Encoding);
  const encName = isName(enc)
    ? enc.name
    : isDict(enc) && isName(enc.BaseEncoding)
      ? enc.BaseEncoding.name
      : '';
  if (isDict(enc)) {
    const diffs = pdf.resolve(enc.Differences);
    if (Array.isArray(diffs)) {
      let code = 0;
      for (const d of diffs) {
        if (typeof d === 'number') code = d;
        else if (isName(d)) {
          const ch = glyphName(d.name);
          if (ch !== undefined) table[code] = ch;
          code++;
        }
      }
    }
  }
  const simple = (code: number) =>
    table[code] ??
    (encName === 'MacRomanEncoding' && code >= 128
      ? MAC_ROMAN_HIGH[code - 128]
      : (WIN_ANSI_HIGH[code] ?? (code >= 32 ? String.fromCharCode(code) : '')));

  const ranges = toUnicode?.ranges.length
    ? toUnicode.ranges
    : [{ bytes: twoByte ? 2 : 1, lo: 0, hi: twoByte ? 0xffff : 0xff }];

  return {
    decode(bytes) {
      let s = '';
      for (let i = 0; i < bytes.length; ) {
        // The shortest code length whose range holds the next bytes.
        let width = ranges[0].bytes;
        for (const n of [1, 2, 3, 4]) {
          if (i + n > bytes.length) break;
          const code = bytesToCode(bytes.subarray(i, i + n));
          if (ranges.some((r) => r.bytes === n && code >= r.lo && code <= r.hi)) {
            width = n;
            break;
          }
        }
        const code = bytesToCode(bytes.subarray(i, i + width));
        i += width;
        const mapped = toUnicode?.map.get(code);
        if (mapped !== undefined) s += mapped;
        else if (!twoByte) s += simple(code);
      }
      return s;
    },
  };
}

const MAC_ROMAN_HIGH =
  'ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®©™´¨≠ÆØ∞±≤≥¥µ∂∑∏π∫ªºΩæø¿¡¬√ƒ≈∆«»… ÀÃÕŒœ–—“”‘’÷◊ÿŸ⁄€‹›ﬁﬂ‡·‚„‰ÂÊÁËÈÍÎÏÌÓÔÒÚÛÙıˆ˜¯˘˙˚¸˝˛ˇ';

// ---------- Page content: where each piece of text sits ----------

type Piece = { text: string; x: number; y: number; size: number };
type Matrix = [number, number, number, number, number, number];

const multiply = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[1] * n[2],
  m[0] * n[1] + m[1] * n[3],
  m[2] * n[0] + m[3] * n[2],
  m[2] * n[1] + m[3] * n[3],
  m[4] * n[0] + m[5] * n[2] + n[4],
  m[4] * n[1] + m[5] * n[3] + n[5],
];
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

function readContent(
  pdf: PdfFile,
  content: Uint8Array,
  resources: PdfDict,
  pieces: Piece[],
  ctm: Matrix = IDENTITY,
  depth = 0,
) {
  const fonts = pdf.dict(resources.Font) ?? EMPTY;
  const xobjects = pdf.dict(resources.XObject) ?? EMPTY;
  const decoders = new Map<string, FontDecoder>();
  const decoderFor = (name: string) => {
    let d = decoders.get(name);
    if (!d) decoders.set(name, (d = fontDecoder(pdf, pdf.dict(fonts[name]))));
    return d;
  };

  let gstate: Matrix = ctm;
  const stack: Matrix[] = [];
  let tm: Matrix = IDENTITY;
  let tlm: Matrix = IDENTITY;
  let leading = 0;
  let fontSize = 12;
  let font: FontDecoder = { decode: (b) => latin1(b) };
  let operands: PdfValue[] = [];

  const nextLine = (tx: number, ty: number) => {
    tlm = multiply([1, 0, 0, 1, tx, ty], tlm);
    tm = tlm;
  };
  const show = (text: string) => {
    if (!text) return;
    const m = multiply(tm, gstate);
    const scale = Math.hypot(m[2], m[3]) || 1;
    pieces.push({ text, x: m[4], y: m[5], size: fontSize * scale });
    // Move along roughly by the text's width so the next piece lands after it.
    tm = multiply([1, 0, 0, 1, text.length * fontSize * 0.5, 0], tm);
  };
  const showArray = (arr: PdfValue[]) => {
    let text = '';
    for (const part of arr) {
      if (part instanceof Uint8Array) text += font.decode(part);
      // A big negative adjustment is a gap between words in PDFs that leave spaces out.
      else if (typeof part === 'number' && part < -180 && !text.endsWith(' ')) text += ' ';
    }
    show(text);
  };

  const lex = new Lexer(content);
  for (let t = lex.next(); t !== undefined; t = lex.next()) {
    if (!isOpToken(t)) {
      operands.push(t);
      continue;
    }
    const n = (i: number) => (typeof operands[i] === 'number' ? (operands[i] as number) : 0);
    switch (t.op) {
      case 'q':
        stack.push(gstate);
        break;
      case 'Q':
        gstate = stack.pop() ?? ctm;
        break;
      case 'cm':
        gstate = multiply([n(0), n(1), n(2), n(3), n(4), n(5)], gstate);
        break;
      case 'BT':
        tm = tlm = IDENTITY;
        break;
      case 'Tf': {
        const name = operands[0];
        if (isName(name)) font = decoderFor(name.name);
        fontSize = n(1) || fontSize;
        break;
      }
      case 'TL':
        leading = n(0);
        break;
      case 'Td':
        nextLine(n(0), n(1));
        break;
      case 'TD':
        leading = -n(1);
        nextLine(n(0), n(1));
        break;
      case 'Tm':
        tm = tlm = [n(0), n(1), n(2), n(3), n(4), n(5)];
        break;
      case 'T*':
        nextLine(0, -leading);
        break;
      case 'Tj':
        if (operands[0] instanceof Uint8Array) show(font.decode(operands[0]));
        break;
      case "'":
        nextLine(0, -leading);
        if (operands[0] instanceof Uint8Array) show(font.decode(operands[0]));
        break;
      case '"':
        nextLine(0, -leading);
        if (operands[2] instanceof Uint8Array) show(font.decode(operands[2]));
        break;
      case 'TJ':
        if (Array.isArray(operands[0])) showArray(operands[0]);
        break;
      case 'Do': {
        const name = operands[0];
        if (!isName(name) || depth > 4) break;
        const obj = pdf.objectFor(xobjects[name.name]);
        const d = obj && isDict(obj.value) ? obj.value : undefined;
        if (obj?.stream && d && isName(d.Subtype) && d.Subtype.name === 'Form') {
          const m = pdf.resolve(d.Matrix);
          const formMatrix =
            Array.isArray(m) && m.length === 6 ? (m.map(Number) as Matrix) : IDENTITY;
          readContent(
            pdf,
            pdf.streamData(obj),
            pdf.dict(d.Resources) ?? resources,
            pieces,
            multiply(formMatrix, gstate),
            depth + 1,
          );
        }
        break;
      }
      case 'BI': {
        // An inline image: skip its binary data up to "EI".
        const b = lex.b;
        while (lex.pos < lex.end) {
          if (
            b[lex.pos] === 69 &&
            b[lex.pos + 1] === 73 &&
            WHITESPACE.has(b[lex.pos - 1]) &&
            (lex.pos + 2 >= lex.end || WHITESPACE.has(b[lex.pos + 2]))
          ) {
            lex.pos += 2;
            break;
          }
          lex.pos++;
        }
        break;
      }
    }
    operands = [];
  }
}

/** Puts the pieces back together as lines of text. */
function piecesToLines(pieces: Piece[]): string[] {
  const lines: string[] = [];
  let line = '';
  let prev: Piece | undefined;
  for (const p of pieces) {
    if (prev) {
      const sameLine = Math.abs(p.y - prev.y) < Math.max(prev.size, p.size) * 0.4;
      if (!sameLine) {
        lines.push(line);
        // A gap of more than about a line and a half is a new paragraph.
        if (Math.abs(p.y - prev.y) > Math.max(prev.size, p.size) * 1.9) lines.push('');
        line = '';
      } else {
        const prevEnd = prev.x + estimateWidth(prev);
        if (p.x > prevEnd + p.size * 0.15 && !line.endsWith(' ') && !p.text.startsWith(' '))
          line += ' ';
      }
    }
    line += p.text;
    prev = p;
  }
  lines.push(line);
  return lines.map((l) => l.replace(/\s+/g, ' ').trim());
}

const estimateWidth = (p: Piece) => p.text.length * p.size * 0.45;

const LIGATURES: Record<string, string> = {
  ﬀ: 'ff',
  ﬁ: 'fi',
  ﬂ: 'fl',
  ﬃ: 'ffi',
  ﬄ: 'ffl',
  ﬅ: 'st',
  ﬆ: 'st',
};

/** The text of every page, as lines. Throws PdfProblem when the PDF can't be read. */
export function pdfLines(bytes: Uint8Array): string[] {
  const pdf = new PdfFile(bytes);
  const out: string[] = [];
  for (const { page, resources } of pdf.pages()) {
    const pieces: Piece[] = [];
    try {
      readContent(pdf, pdf.pageContent(page), resources, pieces);
    } catch {
      continue; // One broken page shouldn't lose the rest.
    }
    out.push(...piecesToLines(pieces), '');
  }
  return out.map((l) =>
    l
      .replace(/[ﬀ-ﬆ]/g, (c) => LIGATURES[c] ?? c)
      // Control characters and unmapped glyphs.
      .replace(/[\u0000-\u0008\u000b-\u001f�]/g, '')
      .trim(),
  );
}
