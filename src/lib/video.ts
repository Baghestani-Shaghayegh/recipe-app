import { decodeEntities } from './instagram';

export type VideoSite = 'YouTube' | 'TikTok';

export type VideoPost = {
  site: VideoSite;
  url: string;
  /** The title followed by the description or caption: what the recipe text is read from. */
  caption: string;
  author?: string;
  imageUrl?: string;
};

/** Finds a YouTube video or Shorts link in the text and returns its canonical watch URL. */
export function parseYoutubeUrl(text: string): string | undefined {
  const m =
    text.match(/https?:\/\/(?:www\.|m\.)?youtube\.com\/watch\?[^\s]*?\bv=([\w-]{11})/i) ??
    text.match(/https?:\/\/(?:www\.|m\.)?youtube\.com\/(?:shorts|embed|live)\/([\w-]{11})/i) ??
    text.match(/https?:\/\/youtu\.be\/([\w-]{11})/i);
  return m ? `https://www.youtube.com/watch?v=${m[1]}` : undefined;
}

/** Finds a TikTok video link (including short vm./vt. links) in the text. */
export function parseTiktokUrl(text: string): string | undefined {
  const m = text.match(
    /https?:\/\/(?:(?:www|m)\.tiktok\.com\/(?:@[\w.]+\/video\/\d+|t\/\w+)|(?:vm|vt)\.tiktok\.com\/\w+)\/?/i,
  );
  return m?.[0];
}

export function videoSiteOf(text: string): VideoSite | undefined {
  if (parseYoutubeUrl(text)) return 'YouTube';
  if (parseTiktokUrl(text)) return 'TikTok';
  return undefined;
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

/** Reads a YouTube watch page: title, full description (from the page's player data), channel, thumbnail. */
export function extractYoutubePost(html: string, url: string): VideoPost | undefined {
  const title = metaContent(html, 'og:title');
  let description: string | undefined;
  const raw = html.match(/"shortDescription":"((?:[^"\\]|\\.)*)"/)?.[1];
  if (raw !== undefined) {
    try {
      description = JSON.parse(`"${raw}"`) as string;
    } catch {
      // Fall back to the shortened og:description below.
    }
  }
  description = description?.trim() || metaContent(html, 'og:description')?.trim();
  if (!title && !description) return undefined;
  const author = html.match(/"author":"((?:[^"\\]|\\.)*)"/)?.[1];
  return {
    site: 'YouTube',
    url,
    caption: [title, description].filter(Boolean).join('\n\n'),
    author: author ? decodeEntities(author) : undefined,
    imageUrl: metaContent(html, 'og:image'),
  };
}

/** Reads TikTok's public oEmbed answer: `title` is the video's caption. */
export function extractTiktokPost(json: unknown, url: string): VideoPost | undefined {
  if (typeof json !== 'object' || json === null) return undefined;
  const o = json as { title?: unknown; author_name?: unknown; thumbnail_url?: unknown };
  const caption = typeof o.title === 'string' ? o.title.trim() : '';
  if (!caption) return undefined;
  return {
    site: 'TikTok',
    url,
    caption,
    author: typeof o.author_name === 'string' ? o.author_name : undefined,
    imageUrl: typeof o.thumbnail_url === 'string' ? o.thumbnail_url : undefined,
  };
}

export class VideoError extends Error {
  readonly reason: 'not-a-video' | 'network' | 'no-caption';

  constructor(message: string, reason: VideoError['reason']) {
    super(message);
    this.reason = reason;
  }
}

/** Loads the title and description/caption of a YouTube or TikTok video. Phone app only (browsers block it). */
export async function fetchVideoPost(
  link: string,
  fetchImpl: typeof fetch = fetch,
): Promise<VideoPost> {
  const youtube = parseYoutubeUrl(link);
  const tiktok = youtube ? undefined : parseTiktokUrl(link);
  if (!youtube && !tiktok) {
    throw new VideoError('That doesn’t look like a YouTube or TikTok video link.', 'not-a-video');
  }
  let post: VideoPost | undefined;
  try {
    if (youtube) {
      const res = await fetchImpl(youtube, { headers: { Accept: 'text/html' } });
      if (!res.ok) throw new Error(String(res.status));
      post = extractYoutubePost(await res.text(), youtube);
    } else {
      const res = await fetchImpl(
        `https://www.tiktok.com/oembed?url=${encodeURIComponent(tiktok!)}`,
      );
      if (!res.ok) throw new Error(String(res.status));
      post = extractTiktokPost(await res.json(), tiktok!);
    }
  } catch {
    throw new VideoError(
      'Couldn’t open that video. Check the link and your connection.',
      'network',
    );
  }
  if (!post) throw new VideoError('Couldn’t find a description on that video.', 'no-caption');
  return post;
}
