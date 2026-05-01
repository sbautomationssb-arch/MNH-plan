import { getInstagramThumbnail } from "@/lib/instagram";

export const revalidate = 86400;

const ALLOWED_HOST = /(\.|^)instagram\.com$/i;

export async function GET(req: Request) {
  const target = new URL(req.url).searchParams.get("url");
  if (!target) return new Response("Missing url", { status: 400 });

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return new Response("Invalid url", { status: 400 });
  }
  if (!ALLOWED_HOST.test(parsed.hostname)) {
    return new Response("Forbidden host", { status: 403 });
  }

  const ogImage = await getInstagramThumbnail(parsed.toString());
  if (!ogImage) return new Response("Not found", { status: 404 });

  const upstream = await fetch(ogImage, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Referer: "https://www.instagram.com/",
    },
    next: { revalidate: 86400 },
  });

  if (!upstream.ok || !upstream.body) {
    return new Response("Upstream failed", { status: 502 });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "image/jpeg",
      "Cache-Control":
        "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
