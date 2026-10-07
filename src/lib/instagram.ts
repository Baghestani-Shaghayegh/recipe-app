export type InstagramLink = { kind: 'p' | 'reel' | 'tv'; code: string; url: string };

export type InstagramPost = {
  url: string;
  caption: string;
  author?: string;
  imageUrl?: string;
};

/** Finds an Instagram post/reel link anywhere in the text (shared text often has extra words). */
export function parseInstagramUrl(text: string): InstagramLink | undefined {
  const m = text.match(
    /https?:\/\/(?:www\.|m\.)?(?:instagram\.com|instagr\.am)\/(?:[\w.]+\/)?(p|reels?|tv)\/([\w-]+)/i,
  );
  if (!m) return undefined;
  const kind = (
    m[1].toLowerCase() === 'reels' ? 'reel' : m[1].toLowerCase()
  ) as InstagramLink['kind'];
  const code = m[2];
  return { kind, code, url: `https://www.instagram.com/${kind}/${code}/` };
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === '#') {
      const n =
        code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : whole;
    }
    return ENTITIES[code.toLowerCase()] ?? whole;
  });
}

function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div)>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function metaContent(html: string, property: string): string | undefined {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]*content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${property}["']`,
    'i',
  );
  const m = html.match(re);
  const value = m?.[1] ?? m?.[2];
  return value === undefined ? undefined : decodeEntities(value);
}

/**
 * Pulls the caption, author and image out of Instagram's public embed page
 * (instagram.com/p/<code>/embed/captioned/), falling back to the page's og: tags.
 */
export function extractPostFromHtml(html: string, url: string): InstagramPost | undefined {
  let caption: string | undefined;
  let author: string | undefined;

  const captionStart = html.search(/<div[^>]+class="[^"]*\bCaption\b[^"]*"/);
  if (captionStart >= 0) {
    const rest = html.slice(captionStart);
    const end = rest.search(/<div[^>]+class="[^"]*\bCaptionComments\b/);
    let block = end > 0 ? rest.slice(0, end) : rest.slice(0, 20000);
    const user = block.match(/<a[^>]+class="[^"]*\bCaptionUsername\b[^"]*"[^>]*>([\s\S]*?)<\/a>/);
    if (user) {
      author = htmlToText(user[1]);
      block = block.replace(user[0], '');
    }
    caption = htmlToText(block) || undefined;
  }

  if (!caption) {
    // og:description looks like: 1,234 likes, 56 comments - user on May 1, 2025: "caption".
    const og = metaContent(html, 'og:description') ?? metaContent(html, 'description');
    const m = og?.match(/^[\s\S]*?-\s*([\w.]+)\s+on\s+[^:]+:\s*["“]([\s\S]*)["”]\.?\s*$/);
    if (m) {
      author = author ?? m[1];
      caption = m[2].trim();
    }
  }
  if (!caption) return undefined;

  const img =
    html.match(/<img[^>]+class="[^"]*\bEmbeddedMediaImage\b[^"]*"[^>]*src="([^"]+)"/)?.[1] ??
    metaContent(html, 'og:image');

  return { url, caption, author, imageUrl: img ? decodeEntities(img) : undefined };
}

export class InstagramError extends Error {
  readonly reason: 'not-instagram' | 'network' | 'no-caption';

  constructor(message: string, reason: InstagramError['reason']) {
    super(message);
    this.reason = reason;
  }
}

/**
 * Loads a public post's caption. Works in the phone app; browsers block this request (CORS),
 * so on the web callers should ask for the caption to be pasted instead.
 */
export async function fetchInstagramPost(
  link: string,
  fetchImpl: typeof fetch = fetch,
): Promise<InstagramPost> {
  const parsed = parseInstagramUrl(link);
  if (!parsed)
    throw new InstagramError('That doesn’t look like an Instagram post link.', 'not-instagram');

  const pages = [`https://www.instagram.com/p/${parsed.code}/embed/captioned/`, parsed.url];
  let reachedInstagram = false;
  for (const page of pages) {
    try {
      const res = await fetchImpl(page, { headers: { Accept: 'text/html' } });
      if (!res.ok) continue;
      reachedInstagram = true;
      const post = extractPostFromHtml(await res.text(), parsed.url);
      if (post) return post;
    } catch {
      // Try the next page.
    }
  }
  throw reachedInstagram
    ? new InstagramError('Couldn’t find a caption on that post. It may be private.', 'no-caption')
    : new InstagramError('Couldn’t reach Instagram. Check your connection.', 'network');
}
