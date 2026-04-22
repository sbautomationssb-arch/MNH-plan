import type { Bucket } from "@/lib/content";

export function BucketCard({ bucket }: { bucket: Bucket }) {
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
        <div className="text-teal text-[10px] font-semibold uppercase tracking-[0.14em] mb-2">
          Références visuelles
        </div>
        {bucket.refs.length === 0 ? (
          <p className="text-xs italic opacity-50">À venir</p>
        ) : (
          <ul className="space-y-1">
            {bucket.refs.map((ref) => (
              <li key={ref} className="text-xs">
                <a
                  href={ref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-teal transition-colors"
                >
                  → {ref.replace(/^https?:\/\/(www\.)?/, "")}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
