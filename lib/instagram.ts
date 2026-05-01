const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
};

const OG_IMAGE_RE =
  /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i;
const OG_IMAGE_RE_REVERSED =
  /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i;

export async function getInstagramThumbnail(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: HEADERS,
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const match = html.match(OG_IMAGE_RE) ?? html.match(OG_IMAGE_RE_REVERSED);
    if (!match) return null;
    return match[1].replace(/&amp;/g, "&");
  } catch {
    return null;
  }
}
