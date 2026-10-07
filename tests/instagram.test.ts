import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  decodeEntities,
  extractPostFromHtml,
  fetchInstagramPost,
  parseInstagramUrl,
} from '../src/lib/instagram.ts';

test('recognizes post, reel and tv links, with extra text and query strings', () => {
  assert.deepEqual(parseInstagramUrl('https://www.instagram.com/p/Cabc123_-x/?igsh=xyz'), {
    kind: 'p',
    code: 'Cabc123_-x',
    url: 'https://www.instagram.com/p/Cabc123_-x/',
  });
  assert.equal(
    parseInstagramUrl('Look! https://instagram.com/reel/DEF456/ so good')?.url,
    'https://www.instagram.com/reel/DEF456/',
  );
  assert.equal(parseInstagramUrl('https://www.instagram.com/reels/DEF456')?.kind, 'reel');
  assert.equal(parseInstagramUrl('https://www.instagram.com/someuser/p/GHI789/')?.code, 'GHI789');
  assert.equal(parseInstagramUrl('https://instagr.am/p/JKL/')?.code, 'JKL');
  assert.equal(parseInstagramUrl('https://www.instagram.com/someuser/'), undefined);
  assert.equal(parseInstagramUrl('https://example.com/p/abc'), undefined);
});

test('decodes HTML entities', () => {
  assert.equal(
    decodeEntities('Mac &amp; cheese &#x1f9c0; it&#39;s &quot;good&quot;'),
    'Mac & cheese 🧀 it\'s "good"',
  );
});

// Shaped like Instagram's embed page.
const EMBED_HTML = `<html><body>
<div class="EmbeddedMedia"><img class="EmbeddedMediaImage" alt="" src="https://cdn.example/photo.jpg?a=1&amp;b=2" /></div>
<div class="Caption"><a class="CaptionUsername" href="https://www.instagram.com/chef_sara/">chef_sara</a><br /><br />Lentil soup &#x1f372;<br /><br />Ingredients:<br />1 cup red lentils<br />1 onion<br /><br />Method:<br />1. Cook it all.<br /><a href="/explore/tags/soup/">#soup</a>
<div class="CaptionComments"><a>View all 12 comments</a></div></div>
</body></html>`;

test('reads caption, author and image from the embed page', () => {
  const post = extractPostFromHtml(EMBED_HTML, 'https://www.instagram.com/p/X/');
  assert.equal(post?.author, 'chef_sara');
  assert.equal(post?.imageUrl, 'https://cdn.example/photo.jpg?a=1&b=2');
  assert.equal(
    post?.caption,
    'Lentil soup 🍲\n\nIngredients:\n1 cup red lentils\n1 onion\n\nMethod:\n1. Cook it all.\n#soup',
  );
});

test('falls back to og:description on the post page', () => {
  const html = `<meta property="og:image" content="https://cdn.example/og.jpg" />
<meta property="og:description" content="1,234 likes, 56 comments - chef_sara on May 1, 2025: &quot;Quick pasta&#10;Ingredients&#10;100 g pasta&quot;. " />`;
  const post = extractPostFromHtml(html, 'u');
  assert.equal(post?.author, 'chef_sara');
  assert.equal(post?.caption, 'Quick pasta\nIngredients\n100 g pasta');
  assert.equal(post?.imageUrl, 'https://cdn.example/og.jpg');
});

test('no caption anywhere gives undefined', () => {
  assert.equal(extractPostFromHtml('<html>Login to Instagram</html>', 'u'), undefined);
});

function fakeFetch(pages: Record<string, { status: number; body: string } | 'throw'>) {
  const calls: string[] = [];
  const impl = (async (url: string) => {
    calls.push(url);
    const page = pages[url];
    if (!page || page === 'throw') throw new Error('offline');
    return { ok: page.status < 400, text: async () => page.body } as Response;
  }) as unknown as typeof fetch;
  return { impl, calls };
}

test('fetch uses the embed page first', async () => {
  const { impl, calls } = fakeFetch({
    'https://www.instagram.com/p/ABC/embed/captioned/': { status: 200, body: EMBED_HTML },
  });
  const post = await fetchInstagramPost('https://www.instagram.com/reel/ABC/?igsh=1', impl);
  assert.equal(post.url, 'https://www.instagram.com/reel/ABC/');
  assert.equal(post.author, 'chef_sara');
  assert.deepEqual(calls, ['https://www.instagram.com/p/ABC/embed/captioned/']);
});

test('fetch errors say what went wrong', async () => {
  await assert.rejects(fetchInstagramPost('https://example.com', fakeFetch({}).impl), {
    reason: 'not-instagram',
  });
  await assert.rejects(fetchInstagramPost('https://www.instagram.com/p/A/', fakeFetch({}).impl), {
    reason: 'network',
  });
  const loginWall = fakeFetch({
    'https://www.instagram.com/p/A/embed/captioned/': { status: 200, body: '<html></html>' },
    'https://www.instagram.com/p/A/': { status: 200, body: '<html>Log in</html>' },
  });
  await assert.rejects(fetchInstagramPost('https://www.instagram.com/p/A/', loginWall.impl), {
    reason: 'no-caption',
  });
});
