import type { Release } from "@/lib/content";

export function ReleaseList({ releases }: { releases: Release[] }) {
  if (releases.length === 0) {
    return (
      <div className="text-sm opacity-50 italic">
        Aucune sortie listée pour l&apos;instant. Donne-moi les titres, dates et liens SoundCloud et je les ajoute dans lib/content.ts.
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {releases.map((r) => (
        <article
          key={r.id}
          className="bg-charcoal text-offwhite rounded-3xl p-5 md:p-6 flex flex-col"
        >
          <div className="text-teal text-[11px] font-semibold uppercase tracking-[0.12em] mb-2">
            {r.releaseDate}
          </div>
          <h3 className="display-tight text-2xl md:text-3xl text-teal mb-3">
            {r.title}
          </h3>
          {r.notes && (
            <p className="text-sm leading-relaxed mb-4 opacity-90">{r.notes}</p>
          )}
          {r.soundcloudUrl && (
            <div className="mt-auto pt-3">
              <a
                href={r.soundcloudUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-[11px] font-semibold uppercase tracking-[0.12em] text-teal border border-teal/40 hover:bg-teal hover:text-charcoal rounded-full px-4 py-1.5 transition-colors"
              >
                → SoundCloud
              </a>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
