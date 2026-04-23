import { pillars, contrastPrinciple, buckets, releases, musicSetUrl } from "@/lib/content";
import { BucketCard } from "@/components/BucketCard";
import { ReleaseList } from "@/components/ReleaseList";
import { SubmissionQueue } from "@/components/SubmissionQueue";

export default function Home() {
  return (
    <main className="max-w-6xl mx-auto px-6 md:px-10 py-10 md:py-16">
      {/* Header */}
      <header className="flex items-baseline justify-between mb-8 flex-wrap gap-2">
        <div className="display-tight text-xl text-teal">ara3media</div>
        <div className="text-[11px] uppercase tracking-[0.12em] opacity-70">
          Marie-Neiges · Plan · Mai–Juillet 2026
        </div>
      </header>

      {/* Hero */}
      <h1 className="display-tight text-5xl md:text-7xl mb-3">
        marie-neiges
        <br />
        brand &amp; content plan.
      </h1>
      <div className="h-0.5 w-12 bg-charcoal my-5" />
      <p className="text-sm md:text-base max-w-2xl mb-12">
        Plan brand + exécution contenu · mai–juillet 2026. 5 piliers, un principe directeur, 7 content buckets.
      </p>

      {/* Pillars */}
      <section className="mb-14">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] mb-4">
          01 — Les 5 piliers
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {pillars.map((p) => (
            <div key={p.name} className="bg-charcoal text-offwhite rounded-2xl p-5 min-h-[180px]">
              <h3 className="display-tight text-teal text-lg mb-2">{p.name}</h3>
              <p className="text-xs leading-snug">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Contrast principle */}
      <section className="mb-14">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] mb-4">
          02 — Principe directeur · le contraste
        </div>
        <div className="bg-teal text-charcoal rounded-2xl p-6 md:p-8 text-sm md:text-base leading-relaxed">
          {contrastPrinciple}
        </div>
      </section>

      {/* Buckets */}
      <section>
        <div className="text-xs font-semibold uppercase tracking-[0.14em] mb-4">
          03 — Content buckets
        </div>
        <p className="text-sm mb-6 max-w-2xl">
          Types de contenu qu'on va orchestrer pour Marie-Neiges. On construit au fur et à mesure.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {buckets.map((b) => (
            <BucketCard key={b.id} bucket={b} />
          ))}
        </div>
      </section>

      {/* Releases */}
      <section className="mt-14">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] mb-4">
          04 — Sorties &amp; audios
        </div>
        <p className="text-sm mb-4 max-w-2xl">
          Calendrier des sorties. Les audios vivent sur la playlist SoundCloud privée ci-dessous.
        </p>
        {musicSetUrl && (
          <a
            href={musicSetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mb-6 text-xs font-semibold uppercase tracking-[0.12em] text-charcoal bg-teal hover:opacity-90 rounded-full px-5 py-2 transition-opacity"
          >
            → Écouter la playlist SoundCloud
          </a>
        )}
        <ReleaseList releases={releases} />
      </section>

      <SubmissionQueue />

      <footer className="mt-16 text-[11px] opacity-60">
        Ara3 Media × Marie-Neiges · plan vivant, updaté en continu.
      </footer>
    </main>
  );
}
