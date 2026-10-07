import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  extractTiktokPost,
  extractYoutubePost,
  fetchVideoPost,
  parseTiktokUrl,
  parseYoutubeUrl,
  videoSiteOf,
  type VideoError,
} from '../src/lib/video.ts';

test('finds YouTube links in all common shapes', () => {
  const watch = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
  assert.equal(parseYoutubeUrl(watch), watch);
  assert.equal(parseYoutubeUrl('https://youtu.be/dQw4w9WgXcQ?si=abc'), watch);
  assert.equal(parseYoutubeUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ'), watch);
  assert.equal(
    parseYoutubeUrl('look https://m.youtube.com/watch?feature=share&v=dQw4w9WgXcQ ok'),
    watch,
  );
  assert.equal(parseYoutubeUrl('https://example.com/watch?v=dQw4w9WgXcQ'), undefined);
});

test('finds TikTok links', () => {
  assert.equal(
    parseTiktokUrl('https://www.tiktok.com/@chef.anna/video/7301234567890123456?lang=en'),
    'https://www.tiktok.com/@chef.anna/video/7301234567890123456',
  );
  assert.equal(
    parseTiktokUrl('see https://vm.tiktok.com/ZMabc123/ wow'),
    'https://vm.tiktok.com/ZMabc123/',
  );
  assert.equal(parseTiktokUrl('https://www.tiktok.com/'), undefined);
  assert.equal(videoSiteOf('https://youtu.be/dQw4w9WgXcQ'), 'YouTube');
  assert.equal(videoSiteOf('https://vm.tiktok.com/ZMabc123/'), 'TikTok');
  assert.equal(videoSiteOf('https://example.com'), undefined);
});

const ytPage = `<html><head>
<meta property="og:title" content="Garlic Noodles &amp; More">
<meta property="og:description" content="Short version…">
<meta property="og:image" content="https://i.ytimg.com/vi/x/maxres.jpg">
</head><body><script>var ytInitialPlayerResponse = {"videoDetails":{"author":"Chef Anna","shortDescription":"Ingredients:\\n200 g spaghetti\\n2 tbsp butter\\n\\nMethod:\\n1. Boil \\"al dente\\"."}};</script></body></html>`;

test('reads a YouTube page', () => {
  const post = extractYoutubePost(ytPage, 'u')!;
  assert.equal(post.site, 'YouTube');
  assert.equal(post.author, 'Chef Anna');
  assert.equal(post.imageUrl, 'https://i.ytimg.com/vi/x/maxres.jpg');
  assert.equal(
    post.caption,
    'Garlic Noodles & More\n\nIngredients:\n200 g spaghetti\n2 tbsp butter\n\nMethod:\n1. Boil "al dente".',
  );
  const noPlayer = extractYoutubePost(
    '<meta property="og:title" content="T"><meta name="description" content="D">',
    'u',
  )!;
  assert.equal(noPlayer.caption, 'T');
  assert.equal(extractYoutubePost('<html></html>', 'u'), undefined);
});

test('reads TikTok oEmbed data', () => {
  const post = extractTiktokPost(
    {
      title: 'Easy rice 1 cup rice, 2 cups water #recipe',
      author_name: 'anna',
      thumbnail_url: 'https://t/x.jpg',
    },
    'u',
  )!;
  assert.equal(post.caption, 'Easy rice 1 cup rice, 2 cups water #recipe');
  assert.equal(post.author, 'anna');
  assert.equal(extractTiktokPost({ title: ' ' }, 'u'), undefined);
  assert.equal(extractTiktokPost(null, 'u'), undefined);
});

test('fetchVideoPost reports what went wrong', async () => {
  const yt = (async () => new Response(ytPage)) as typeof fetch;
  assert.equal((await fetchVideoPost('https://youtu.be/dQw4w9WgXcQ', yt)).site, 'YouTube');
  const tt = (async () => Response.json({ title: 'hi', author_name: 'a' })) as typeof fetch;
  assert.equal((await fetchVideoPost('https://vm.tiktok.com/ZMabc123/', tt)).caption, 'hi');

  const reason = (r: string) => (e: VideoError) => e.reason === r;
  const down = (async () => new Response('x', { status: 500 })) as typeof fetch;
  await assert.rejects(fetchVideoPost('https://youtu.be/dQw4w9WgXcQ', down), reason('network'));
  const empty = (async () => new Response('<html></html>')) as typeof fetch;
  await assert.rejects(fetchVideoPost('https://youtu.be/dQw4w9WgXcQ', empty), reason('no-caption'));
  await assert.rejects(fetchVideoPost('https://example.com'), reason('not-a-video'));
});
