"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type SyntheticEvent } from "react";
import { getSupabase, type SubmissionRow } from "@/lib/supabase";

type Status = SubmissionRow["status"];

const URL_REGEX =
  /https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel|tv)\/[A-Za-z0-9_-]+\/?/g;

function normalize(url: string) {
  return url.replace(/\/+$/, "");
}

type BatchResult = { added: number; skipped: number; error?: string };

export function SubmissionQueue() {
  const supabase = useMemo(() => getSupabase(), []);
  const [hydrated, setHydrated] = useState(false);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [draft, setDraft] = useState("");
  const [lastBatch, setLastBatch] = useState<BatchResult | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const commentTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    setHydrated(true);
    if (!supabase) return;
    let cancelled = false;
    supabase
      .from("submissions")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setLoadError(error.message);
          return;
        }
        setSubmissions((data ?? []) as SubmissionRow[]);
      });
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // Realtime sync: any client's INSERT/UPDATE/DELETE lands here too.
  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel("submissions-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "submissions" },
        (payload) => {
          setSubmissions((prev) => {
            if (payload.eventType === "INSERT") {
              const row = payload.new as SubmissionRow;
              if (prev.some((s) => s.id === row.id)) return prev;
              return [row, ...prev];
            }
            if (payload.eventType === "UPDATE") {
              const row = payload.new as SubmissionRow;
              return prev.map((s) => (s.id === row.id ? row : s));
            }
            if (payload.eventType === "DELETE") {
              const oldRow = payload.old as Partial<SubmissionRow>;
              return prev.filter((s) => s.id !== oldRow.id);
            }
            return prev;
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  useEffect(() => {
    const timers = commentTimers.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  const handleProcess = useCallback(async () => {
    if (!supabase) {
      setLastBatch({ added: 0, skipped: 0, error: "Supabase n'est pas configuré." });
      return;
    }
    const matches = draft.match(URL_REGEX) ?? [];
    const seen = new Set<string>();
    const existing = new Set(submissions.map((s) => normalize(s.url)));
    const toInsert: { url: string }[] = [];
    let skipped = 0;
    matches.forEach((raw) => {
      const url = normalize(raw);
      if (seen.has(url) || existing.has(url)) {
        skipped += 1;
        return;
      }
      seen.add(url);
      toInsert.push({ url });
    });
    if (toInsert.length === 0) {
      setLastBatch({ added: 0, skipped });
      return;
    }
    const { data, error } = await supabase
      .from("submissions")
      .insert(toInsert)
      .select();
    if (error) {
      setLastBatch({ added: 0, skipped, error: error.message });
      return;
    }
    const inserted = (data ?? []) as SubmissionRow[];
    // Optimistic local prepend; realtime will dedupe via id.
    setSubmissions((prev) => {
      const known = new Set(prev.map((s) => s.id));
      return [...inserted.filter((r) => !known.has(r.id)), ...prev];
    });
    setDraft("");
    setLastBatch({ added: inserted.length, skipped });
  }, [draft, submissions, supabase]);

  const updateStatus = useCallback(
    async (id: string, status: Status) => {
      if (!supabase) return;
      setSubmissions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status } : s)),
      );
      await supabase.from("submissions").update({ status }).eq("id", id);
    },
    [supabase],
  );

  const toggleStatus = useCallback(
    (id: string, target: "liked" | "refused") => {
      const current = submissions.find((s) => s.id === id);
      if (!current) return;
      const next: Status = current.status === target ? "pending" : target;
      void updateStatus(id, next);
    },
    [submissions, updateStatus],
  );

  const setComment = useCallback(
    (id: string, comment: string) => {
      setSubmissions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, comment } : s)),
      );
      if (!supabase) return;
      const timers = commentTimers.current;
      const existing = timers.get(id);
      if (existing) clearTimeout(existing);
      const t = setTimeout(async () => {
        await supabase.from("submissions").update({ comment }).eq("id", id);
        timers.delete(id);
      }, 500);
      timers.set(id, t);
    },
    [supabase],
  );

  const remove = useCallback(
    async (id: string) => {
      if (!supabase) return;
      setSubmissions((prev) => prev.filter((s) => s.id !== id));
      await supabase.from("submissions").delete().eq("id", id);
    },
    [supabase],
  );

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
        Le système parse, flush la zone, et crée une row par URL. Partagé entre tous
        ceux qui ont le lien — MN peut aimer, refuser ou commenter de son bord.
      </p>

      {!supabase && hydrated && (
        <div className="mb-4 text-xs rounded-2xl border border-red-500/40 bg-red-500/5 text-red-700 px-4 py-3">
          Variables d&apos;env Supabase manquantes
          (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).
          La queue est désactivée tant qu&apos;elles ne sont pas set.
        </div>
      )}

      {loadError && (
        <div className="mb-4 text-xs rounded-2xl border border-red-500/40 bg-red-500/5 text-red-700 px-4 py-3">
          Erreur au chargement : {loadError}
        </div>
      )}

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
            disabled={!draft.trim() || !supabase}
            className="bg-teal text-charcoal font-semibold text-xs uppercase tracking-[0.12em] px-5 py-2 rounded-full disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
          >
            Process
          </button>
        </div>
        {lastBatch && (
          <div className="text-[11px] mt-3 opacity-70">
            {lastBatch.error && <span className="text-red-400">Erreur : {lastBatch.error}. </span>}
            {lastBatch.added > 0 && (
              <>
                +{lastBatch.added} ajoutée{lastBatch.added > 1 ? "s" : ""}.
                {" "}
              </>
            )}
            {lastBatch.skipped > 0 && (
              <>
                {lastBatch.skipped} doublon{lastBatch.skipped > 1 ? "s" : ""} ignoré
                {lastBatch.skipped > 1 ? "s" : ""}.
                {" "}
              </>
            )}
            {!lastBatch.error && lastBatch.added === 0 && lastBatch.skipped === 0 && (
              <>Aucune URL Instagram détectée dans le texte.</>
            )}
          </div>
        )}
      </div>

      {hydrated && submissions.length > 0 && (
        <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.12em] mb-4 opacity-70 flex-wrap">
          <span>{submissions.length} total</span>
          <span>·</span>
          <span>{counts.pending} pending</span>
          <span>·</span>
          <span className="text-teal">{counts.liked} aimées</span>
          <span>·</span>
          <span>{counts.refused} refusées</span>
        </div>
      )}

      {hydrated && supabase && submissions.length === 0 && !loadError && (
        <div className="text-sm opacity-50 italic">
          Aucune submission encore. Drop des URLs au-dessus pour commencer.
        </div>
      )}

      {hydrated && submissions.length > 0 && (
        <div className="space-y-3">
          {submissions.map((s) => (
            <SubmissionRowItem
              key={s.id}
              submission={s}
              onToggle={(target) => toggleStatus(s.id, target)}
              onComment={(comment) => setComment(s.id, comment)}
              onRemove={() => remove(s.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function SubmissionRowItem({
  submission,
  onToggle,
  onComment,
  onRemove,
}: {
  submission: SubmissionRow;
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

  const [thumbBroken, setThumbBroken] = useState(false);
  const handleImgError = (e: SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.style.display = "none";
    setThumbBroken(true);
  };

  return (
    <div className={`rounded-2xl p-4 md:p-5 border transition-colors ${containerCls}`}>
      <div className="flex gap-4">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Ouvrir ${url}`}
          className="shrink-0 block w-24 h-24 md:w-28 md:h-28 rounded-xl overflow-hidden bg-charcoal/10 border border-charcoal/15 relative group"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/ig-thumbnail?url=${encodeURIComponent(url)}`}
            alt=""
            loading="lazy"
            onError={handleImgError}
            className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
          />
          {thumbBroken && (
            <div className="absolute inset-0 flex items-center justify-center p-2 text-[10px] font-mono opacity-50 text-center">
              IG
            </div>
          )}
        </a>
        <div className="flex-1 min-w-0 flex flex-col gap-3">
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
            className="w-full bg-transparent text-sm resize-y outline-none placeholder:opacity-40 border-t border-charcoal/15 pt-2"
          />
        </div>
      </div>
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
