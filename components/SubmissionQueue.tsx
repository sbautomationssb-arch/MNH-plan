"use client";

import { useEffect, useState } from "react";

type Status = "pending" | "liked" | "refused";

type Submission = {
  id: string;
  url: string;
  status: Status;
  comment: string;
  addedAt: number;
};

const STORAGE_KEY = "mnh-submissions";
const URL_REGEX =
  /https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel|tv)\/[A-Za-z0-9_-]+\/?/g;

function normalize(url: string) {
  return url.replace(/\/+$/, "");
}

export function SubmissionQueue() {
  const [hydrated, setHydrated] = useState(false);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [draft, setDraft] = useState("");
  const [lastBatch, setLastBatch] = useState<{ added: number; skipped: number } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSubmissions(JSON.parse(raw));
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(submissions));
    } catch {}
  }, [submissions, hydrated]);

  const handleProcess = () => {
    const matches = draft.match(URL_REGEX) ?? [];
    const existing = new Set(submissions.map((s) => normalize(s.url)));
    const seen = new Set<string>();
    const now = Date.now();
    const fresh: Submission[] = [];
    let skipped = 0;
    matches.forEach((raw, idx) => {
      const url = normalize(raw);
      if (seen.has(url) || existing.has(url)) {
        skipped += 1;
        return;
      }
      seen.add(url);
      fresh.push({
        id: `${now}-${idx}-${Math.random().toString(36).slice(2, 8)}`,
        url,
        status: "pending",
        comment: "",
        addedAt: now + idx,
      });
    });
    if (fresh.length === 0 && skipped === 0) {
      setLastBatch({ added: 0, skipped: 0 });
      return;
    }
    setSubmissions((prev) => [...fresh, ...prev]);
    setDraft("");
    setLastBatch({ added: fresh.length, skipped });
  };

  const update = (id: string, patch: Partial<Submission>) =>
    setSubmissions((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const remove = (id: string) =>
    setSubmissions((prev) => prev.filter((s) => s.id !== id));

  const toggleStatus = (id: string, target: "liked" | "refused") => {
    setSubmissions((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, status: s.status === target ? "pending" : target } : s,
      ),
    );
  };

  const counts = submissions.reduce(
    (acc, s) => {
      acc[s.status] += 1;
      return acc;
    },
    { pending: 0, liked: 0, refused: 0 } as Record<Status, number>,
  );

  return (
    <section className="mt-14">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] mb-4">
        05 — Drop d&apos;URLs à reviewer
      </div>
      <p className="text-sm mb-6 max-w-2xl">
        Colle n&apos;importe quoi qui contient des URLs Instagram (post, reel, tv).
        Le système parse, flush la zone, et crée une row par URL pour que MN puisse
        aimer, refuser, ou commenter.
      </p>

      <div className="bg-charcoal text-offwhite rounded-3xl p-5 md:p-6 mb-6">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Drop ton chaos icitte. Texte, emojis, retours de ligne, peu importe — on extrait juste les URLs IG."
          rows={6}
          className="w-full bg-transparent text-offwhite placeholder:text-offwhite/30 text-sm font-mono resize-y outline-none"
        />
        <div className="flex items-center justify-between mt-3 gap-3 flex-wrap">
          <div className="text-[11px] opacity-60">
            Formats acceptés : instagram.com/p/, /reel/, /tv/
          </div>
          <button
            type="button"
            onClick={handleProcess}
            disabled={!draft.trim()}
            className="bg-teal text-charcoal font-semibold text-xs uppercase tracking-[0.12em] px-5 py-2 rounded-full disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
          >
            Process
          </button>
        </div>
        {lastBatch && (
          <div className="text-[11px] mt-3 opacity-70">
            {lastBatch.added > 0 && <>+{lastBatch.added} ajoutée{lastBatch.added > 1 ? "s" : ""}. </>}
            {lastBatch.skipped > 0 && <>{lastBatch.skipped} doublon{lastBatch.skipped > 1 ? "s" : ""} ignoré{lastBatch.skipped > 1 ? "s" : ""}. </>}
            {lastBatch.added === 0 && lastBatch.skipped === 0 && <>Aucune URL Instagram détectée dans le texte.</>}
          </div>
        )}
      </div>

      {hydrated && submissions.length > 0 && (
        <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.12em] mb-4 opacity-70">
          <span>{submissions.length} total</span>
          <span>·</span>
          <span>{counts.pending} pending</span>
          <span>·</span>
          <span className="text-teal">{counts.liked} aimées</span>
          <span>·</span>
          <span>{counts.refused} refusées</span>
        </div>
      )}

      {hydrated && submissions.length === 0 && (
        <div className="text-sm opacity-50 italic">
          Aucune submission encore. Drop des URLs au-dessus pour commencer.
        </div>
      )}

      {hydrated && submissions.length > 0 && (
        <div className="space-y-3">
          {submissions.map((s) => (
            <SubmissionRow
              key={s.id}
              submission={s}
              onToggle={(target) => toggleStatus(s.id, target)}
              onComment={(comment) => update(s.id, { comment })}
              onRemove={() => remove(s.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function SubmissionRow({
  submission,
  onToggle,
  onComment,
  onRemove,
}: {
  submission: Submission;
  onToggle: (target: "liked" | "refused") => void;
  onComment: (comment: string) => void;
  onRemove: () => void;
}) {
  const { url, status, comment } = submission;
  const isLiked = status === "liked";
  const isRefused = status === "refused";

  const containerCls = isLiked
    ? "bg-teal/10 border-teal"
    : isRefused
      ? "bg-charcoal/[0.03] border-charcoal/15 opacity-60"
      : "bg-offwhite border-charcoal/15";

  return (
    <div className={`rounded-2xl p-4 md:p-5 border transition-colors ${containerCls}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={`font-mono text-xs md:text-sm break-all hover:text-teal transition-colors ${isRefused ? "line-through" : ""}`}
        >
          → {url.replace(/^https?:\/\/(www\.)?/, "")}
        </a>
        <div className="flex items-center gap-2 shrink-0">
          <StatusPill status={status} />
          <button
            type="button"
            onClick={() => onToggle("liked")}
            aria-pressed={isLiked}
            className={`text-[11px] uppercase tracking-[0.1em] px-3 py-1.5 rounded-full border transition-colors ${
              isLiked
                ? "bg-teal text-charcoal border-teal"
                : "border-charcoal/30 hover:border-teal hover:text-teal"
            }`}
          >
            Aimer
          </button>
          <button
            type="button"
            onClick={() => onToggle("refused")}
            aria-pressed={isRefused}
            className={`text-[11px] uppercase tracking-[0.1em] px-3 py-1.5 rounded-full border transition-colors ${
              isRefused
                ? "bg-charcoal text-offwhite border-charcoal"
                : "border-charcoal/30 hover:border-charcoal hover:bg-charcoal hover:text-offwhite"
            }`}
          >
            Refuser
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Supprimer la submission"
            className="text-base leading-none px-2 py-1 opacity-40 hover:opacity-100 transition-opacity"
          >
            ×
          </button>
        </div>
      </div>
      <textarea
        value={comment}
        onChange={(e) => onComment(e.target.value)}
        placeholder="Commentaire de MN…"
        rows={1}
        className="w-full mt-3 bg-transparent text-sm resize-y outline-none placeholder:opacity-40 border-t border-charcoal/15 pt-2"
      />
    </div>
  );
}

function StatusPill({ status }: { status: Status }) {
  const label = status === "liked" ? "Aimé" : status === "refused" ? "Refusé" : "Pending";
  const cls =
    status === "liked"
      ? "bg-teal text-charcoal"
      : status === "refused"
        ? "bg-charcoal text-offwhite"
        : "bg-charcoal/10 text-charcoal";
  return (
    <span
      className={`text-[10px] font-semibold uppercase tracking-[0.12em] px-2 py-1 rounded-full ${cls}`}
    >
      {label}
    </span>
  );
}
