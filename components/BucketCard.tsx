import type { Bucket } from "@/lib/content";
import { getInstagramThumbnail } from "@/lib/instagram";

export async function BucketCard({ bucket }: { bucket: Bucket }) {
  const refsWithThumbs = await Promise.all(
    bucket.refs.map(async (url) => ({
      url,
      thumbnail: await getInstagramThumbnail(url),
    })),
  );

  return (
    <div className="bg-charcoal text-offwhite rounded-3xl p-6 md:p-8">
      <div className="text-teal text-xs font-semibold uppercase tracking-[0.14em] mb-3">
        Bucket #{bucket.id}
      </div>
      <h3 className="display-tight text-3xl md:text-4xl text-teal mb-4">{bucket.name}</h3>
      <p className="text-sm md:text-base leading-relaxed mb-4">
        {bucket.highlight ? (
          <>
            {bucket.description.split(bucket.highlight)[0]}
            <span className="bg-teal text-charcoal px-2 py-0.5 rounded-md font-semibold">
              {bucket.highlight}
            </span>
            {bucket.description.split(bucket.highlight)[1]}
          </>
        ) : (
          bucket.description
        )}
      </p>
      <div className="border-t border-offwhite/15 pt-3 mt-3">
        <div className="text-teal text-[10px] font-semibold uppercase tracking-[0.14em] mb-3">
          Références visuelles
        </div>
        {refsWithThumbs.length === 0 ? (
          <p className="text-xs italic opacity-50">À venir</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {refsWithThumbs.map(({ url, thumbnail }) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="group block aspect-square rounded-xl overflow-hidden bg-offwhite/5 border border-offwhite/10 hover:border-teal transition-colors relative"
              >
                {thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/proxy-image?url=${encodeURIComponent(thumbnail)}`}
                    alt=""
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center p-3 text-center">
                    <span className="text-[10px] font-mono opacity-60 break-all">
                      {url.replace(/^https?:\/\/(www\.)?instagram\.com\//, "")}
                    </span>
                  </div>
                )}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
