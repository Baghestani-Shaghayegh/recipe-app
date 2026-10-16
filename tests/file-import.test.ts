import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { strToU8, unzlibSync, zipSync, zlibSync } from 'fflate';

import {
  FileProblem,
  markdownText,
  recipeTextFromFile,
  ScannedPdf,
  textFromFile,
} from '../src/lib/file-import.ts';
import { pdfPageImages } from '../src/lib/pdf-text.ts';
import { parseRecipeText } from '../src/lib/recipe-text.ts';

// The same recipe saved five ways (made with Chromium, LibreOffice, ReportLab and pandoc).
const fixture = (name: string) =>
  new Uint8Array(readFileSync(new URL(`./fixtures/${name}`, import.meta.url)));

const STEPS = [
  'Cook the spaghetti in plenty of salted boiling water until it is just tender, about ten minutes.',
  'Melt the butter in a pan and fry the garlic for a minute.',
  'Toss the pasta with the butter, lemon and parmesan, and serve straight away.',
];

for (const name of [
  'recipe-browser.pdf', // like a page printed from Notion, Google Docs or a browser
  'recipe-libreoffice.pdf', // like a PDF exported from Word
  'recipe-simple-fonts.pdf', // older PDFs with standard fonts
  'recipe.docx',
  'notion-export.zip',
]) {
  test(`reads the recipe from ${name}`, () => {
    const recipe = parseRecipeText(textFromFile({ name, bytes: fixture(name) }));
    assert.equal(recipe.title, 'Lemon Garlic Pasta');
    assert.equal(recipe.servings, 2);
    assert.equal(recipe.ingredients.length, 5);
    assert.match(recipe.ingredients[0], /200 g spaghetti/);
    assert.match(recipe.ingredients[4], /½ cup grated parmesan/);
    assert.deepEqual(
      recipe.steps.map((s) => s.replace(/^\d+\.\s*/, '')),
      STEPS,
    );
  });
}

test('finds the file type from its first bytes when the name has no extension', () => {
  const text = textFromFile({ name: 'download', bytes: fixture('recipe-browser.pdf') });
  assert.match(text, /Lemon Garlic Pasta/);
});

test('opens a Notion export zipped inside another zip', () => {
  const inner = zipSync({
    'Pancakes 9a8b.md': strToU8('# Pancakes\n\n## Ingredients\n\n- 2 eggs'),
  });
  const outer = zipSync({ 'Export-Part-1.zip': inner });
  assert.equal(
    textFromFile({ name: 'Export.zip', bytes: outer }),
    'Pancakes\n\nIngredients\n\n- 2 eggs',
  );
});

test('cleans Notion Markdown: headings, to-dos, links, bold and tables', () => {
  assert.equal(
    markdownText(
      [
        '# Soup',
        '- [ ] 1 **onion**',
        '- [x] [stock](https://example.com)',
        '![photo](soup.jpg)',
        '| Prep | 10 min |',
        '| --- | --- |',
        '> Tip: _don’t_ boil',
      ].join('\n'),
    ),
    ['Soup', '- 1 onion', '- stock', '', 'Prep 10 min', '', 'Tip: don’t boil'].join('\n'),
  );
});

test('reads HTML: lists become lines, entities are decoded, scripts are dropped', () => {
  const html =
    '<html><head><title>x</title></head><body><h1>Tea &amp; Toast</h1>' +
    '<script>var a = 1;</script><ul><li>1 slice\n bread</li><li>&frac12; tsp tea</li></ul></body></html>';
  assert.equal(
    textFromFile({ name: 'page.html', bytes: strToU8(html) }),
    'Tea & Toast\n\n- 1 slice bread\n- ½ tsp tea',
  );
});

test('reads UTF-16 text files', () => {
  const s = 'Crêpes\n2 eggs';
  const bytes = new Uint8Array(2 + s.length * 2);
  bytes.set([0xff, 0xfe]);
  for (let i = 0; i < s.length; i++) bytes[2 + i * 2] = s.charCodeAt(i);
  assert.equal(textFromFile({ name: 'notes.txt', bytes }), s);
});

/** Builds a PDF the way Word does: objects packed in a compressed object stream. */
function packedPdf(): Uint8Array {
  // Letters are stored as codes 1–26 (a–z) and 32 (space), mapped back by a ToUnicode CMap.
  const codes = (s: string) =>
    [...s]
      .map((ch) => (ch === ' ' ? '0020' : (ch.charCodeAt(0) - 96).toString(16).padStart(4, '0')))
      .join('');
  const content = [
    'BT /F1 12 Tf 72 700 Td',
    // No space glyph between the words, just a big gap, like some PDFs from Word.
    `[<${codes('plain')}> -300 <${codes('toast')}>] TJ`,
    `0 -16 Td <${codes('with butter')}> Tj`,
    'ET',
  ].join('\n');
  const cmap = [
    'begincmap',
    '1 begincodespacerange <0000> <FFFF> endcodespacerange',
    '1 beginbfchar <0020> <0020> endbfchar',
    '1 beginbfrange <0001> <001A> <0061> endbfrange',
    'endcmap',
  ].join('\n');
  const packed = [
    '<< /Type /Catalog /Pages 3 0 R >>',
    '<< /Type /Pages /Kids [4 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 3 0 R /Resources << /Font << /F1 5 0 R >> >> /Contents 7 0 R >>',
    '<< /Type /Font /Subtype /Type0 /BaseFont /X /Encoding /Identity-H /ToUnicode 6 0 R >>',
  ];
  let offsets = '';
  let body = '';
  packed.forEach((obj, i) => {
    offsets += `${i + 2} ${body.length} `;
    body += `${obj}\n`;
  });
  const objStm = zlibSync(strToU8(offsets + body));
  const flate = zlibSync(strToU8(content));

  const parts: (string | Uint8Array)[] = [
    '%PDF-1.5\n',
    `1 0 obj\n<< /Type /ObjStm /N ${packed.length} /First ${offsets.length} /Filter /FlateDecode /Length ${objStm.length} >>\nstream\n`,
    objStm,
    '\nendstream\nendobj\n',
    `6 0 obj\n<< /Length ${cmap.length} >>\nstream\n${cmap}\nendstream\nendobj\n`,
    `7 0 obj\n<< /Filter /FlateDecode /Length ${flate.length} >>\nstream\n`,
    flate,
    '\nendstream\nendobj\ntrailer\n<< /Root 2 0 R >>\n%%EOF\n',
  ];
  const chunks = parts.map((p) => (typeof p === 'string' ? strToU8(p, true) : p));
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

test('reads PDFs with packed objects, two-byte fonts and gaps instead of spaces', () => {
  assert.equal(textFromFile({ name: 'w.pdf', bytes: packedPdf() }), 'plain toast\nwith butter');
});

const problem = (bytes: Uint8Array, name: string) => {
  try {
    textFromFile({ name, bytes });
  } catch (e) {
    assert.ok(e instanceof FileProblem);
    return e.message;
  }
  assert.fail('expected a FileProblem');
};

test('a PDF with no text and no pictures counts as a scan', () => {
  const pdf = strToU8(
    '%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n' +
      '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n' +
      '3 0 obj << /Type /Page /Parent 2 0 R /Contents 4 0 R >> endobj\n' +
      '4 0 obj << /Length 18 >>\nstream\nq 1 0 0 1 0 0 cm Q\nendstream endobj\n%%EOF',
  );
  assert.throws(() => textFromFile({ name: 'scan.pdf', bytes: pdf }), ScannedPdf);
});

test('explains a locked PDF', () => {
  const pdf = strToU8('%PDF-1.6\n1 0 obj << >> endobj\ntrailer << /Root 1 0 R /Encrypt 5 0 R >>');
  assert.match(problem(pdf, 'locked.pdf'), /locked/);
});

test('refuses file types it can’t read', () => {
  assert.match(problem(Uint8Array.of(1, 2, 3), 'photo.heic'), /can’t be imported/);
  assert.match(problem(strToU8('PK\u0003\u0004 broken'), 'x.zip'), /damaged/);
});

// ---------- Scanned PDFs (pages that are pictures) ----------

/** The parts of a PNG file, to check what was written. */
function readPng(png: Uint8Array) {
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const chunks: Record<string, Uint8Array> = {};
  for (let at = 8; at < png.length; ) {
    const len = view.getUint32(at);
    const type = String.fromCharCode(...png.subarray(at + 4, at + 8));
    chunks[type] = png.subarray(at + 8, at + 8 + len);
    at += 12 + len;
  }
  const ihdr = new DataView(chunks.IHDR.buffer, chunks.IHDR.byteOffset, 13);
  return {
    width: ihdr.getUint32(0),
    height: ihdr.getUint32(4),
    bitDepth: chunks.IHDR[8],
    colorType: chunks.IHDR[9],
    rows: unzlibSync(chunks.IDAT),
    ended: 'IEND' in chunks,
  };
}

test('takes the JPEG page picture out of a scan from a phone scanning app', () => {
  const [page, ...rest] = pdfPageImages(fixture('scan-jpeg.pdf'));
  assert.equal(rest.length, 0);
  assert.equal(page.type, 'jpeg');
  assert.deepEqual([page.width, page.height], [700, 900]);
  assert.deepEqual([...page.data.subarray(0, 2)], [0xff, 0xd8]); // JPEG start
  assert.deepEqual([...page.data.subarray(-2)], [0xff, 0xd9]); // and end
});

test('turns a grey zip-compressed page picture into a PNG', () => {
  const [page] = pdfPageImages(fixture('scan-gray.pdf'));
  assert.equal(page.type, 'png');
  const png = readPng(page.data);
  assert.deepEqual([png.width, png.height, png.bitDepth, png.colorType], [700, 900, 8, 0]);
  assert.equal(png.rows.length, (700 + 1) * 900);
  assert.ok(png.ended);
});

test('turns a black-and-white page with flipped values into a 1-bit PNG', () => {
  // 320×300 pixels, 1 bit each: 40 bytes a row. /Decode [1 0] means 1 is black.
  const raw = new Uint8Array(40 * 300).fill(0b11110000);
  const flate = zlibSync(raw);
  const head =
    '%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n' +
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n' +
    '3 0 obj << /Type /Page /Parent 2 0 R /Resources << /XObject << /Im0 4 0 R >> >> >> endobj\n' +
    `4 0 obj << /Type /XObject /Subtype /Image /Width 320 /Height 300 /BitsPerComponent 1 /ColorSpace /DeviceGray /Decode [1 0] /Filter /FlateDecode /Length ${flate.length} >>\nstream\n`;
  const tail = '\nendstream endobj\n%%EOF';
  const pdf = new Uint8Array([...strToU8(head), ...flate, ...strToU8(tail)]);

  const [page] = pdfPageImages(pdf);
  const png = readPng(page.data);
  assert.deepEqual([png.width, png.height, png.bitDepth, png.colorType], [320, 300, 1, 0]);
  // Each row: filter byte 0, then the pixels flipped so that black is 0 as PNG expects.
  assert.deepEqual([...png.rows.subarray(0, 3)], [0, 0b00001111, 0b00001111]);
});

test('reads a scan with the phone’s text recognition, then cleans the text up', async () => {
  const seen: string[] = [];
  const text = await recipeTextFromFile(
    { name: 'scan.pdf', bytes: fixture('scan-jpeg.pdf') },
    async (images) => {
      seen.push(...images.map((i) => i.type));
      return ['Toast', '+ 1 slice bread', '2, Toast it until golden and crisp on both', 'sides.'];
    },
  );
  assert.deepEqual(seen, ['jpeg']);
  assert.equal(text, 'Toast\n- 1 slice bread\n2. Toast it until golden and crisp on both sides.');
});

test('explains scans it can’t read', async () => {
  const fail = (name: string, readImages?: () => Promise<string[]>) =>
    recipeTextFromFile({ name, bytes: fixture(name) }, readImages).then(
      () => assert.fail('expected a FileProblem'),
      (e: unknown) => {
        assert.ok(e instanceof FileProblem);
        return e.message;
      },
    );
  // Expo Go and the web have no text recognition.
  assert.match(await fail('scan-jpeg.pdf'), /works in the installed app/);
  // Fax-style black-and-white compression isn't something phones can open as a picture.
  assert.match(await fail('scan-black-and-white.pdf', async () => []), /format the app can’t open/);
  // Recognition found nothing.
  assert.match(await fail('scan-gray.pdf', async () => ['', ' ']), /Couldn’t find any text/);
  // Text PDFs never reach text recognition.
  assert.match(
    await recipeTextFromFile({ name: 'r.pdf', bytes: fixture('recipe-browser.pdf') }, async () =>
      assert.fail('should not run'),
    ),
    /Lemon Garlic Pasta/,
  );
});
