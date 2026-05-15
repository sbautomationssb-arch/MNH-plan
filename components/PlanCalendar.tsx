"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type SyntheticEvent } from "react";
import {
  getSupabase,
  PRODUCTION_STATUSES,
  PRODUCTION_STATUS_LABEL,
  type ProductionStatus,
  type SubmissionRow,
} from "@/lib/supabase";
import { buckets } from "@/lib/content";

const STATUS_BADGE_CLS: Record<ProductionStatus, string> = {
  draft: "bg-charcoal/30 text-offwhite",
  shot: "bg-yellow-300 text-charcoal",
  edited: "bg-orange-400 text-charcoal",
  posted: "bg-teal text-charcoal",
};

const STATUS_DOT_CLS: Record<ProductionStatus, string> = {
  draft: "bg-charcoal/40",
  shot: "bg-yellow-300",
  edited: "bg-orange-400",
  posted: "bg-teal",
};

const MONTH_NAMES = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];
const DAY_HEADERS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

// Sentinel id used while dragging the always-on empty pool card.
const DRAFT_DRAG_ID = "__draft__";

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function dateKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function firstOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

// Returns the Monday on or before the given date.
function mondayOnOrBefore(d: Date) {
  const out = new Date(d);
  const dow = (out.getDay() + 6) % 7; // 0 = Mon … 6 = Sun
  out.setDate(out.getDate() - dow);
  return out;
}

function buildMonthGrid(anchor: Date): Date[] {
  const start = mondayOnOrBefore(firstOfMonth(anchor));
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  // Trim trailing week if it's entirely in next month and we already covered the
  // full target month. Result is 35 or 42 days.
  const target = anchor.getMonth();
  const lastWeekStart = days[35];
  const lastWeekAllNext = days.slice(35, 42).every((d) => d.getMonth() !== target);
  if (lastWeekStart && lastWeekAllNext) return days.slice(0, 35);
  return days;
}

export function PlanCalendar() {
  const supabase = useMemo(() => getSupabase(), []);
  const [hydrated, setHydrated] = useState(false);
  const [rows, setRows] = useState<SubmissionRow[]>([]);
  const [monthAnchor, setMonthAnchor] = useState<Date>(() => firstOfMonth(new Date()));
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");
  const draftTextRef = useRef("");
  useEffect(() => {
    draftTextRef.current = draftText;
  }, [draftText]);

  useEffect(() => {
    setHydrated(true);
    if (!supabase) return;
    let cancelled = false;
    supabase
      .from("submissions")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled || error) return;
        setRows((data ?? []) as SubmissionRow[]);
      });
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel("submissions-calendar")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "submissions" },
        (payload) => {
          setRows((prev) => {
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
              const old = payload.old as Partial<SubmissionRow>;
              return prev.filter((s) => s.id !== old.id);
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

  const persist = useCallback(
    async (id: string, scheduled_for: string | null) => {
      if (!supabase) return;
      await supabase.from("submissions").update({ scheduled_for }).eq("id", id);
    },
    [supabase],
  );

  const move = useCallback(
    (id: string, scheduled_for: string | null) => {
      setRows((prev) =>
        prev.map((s) => (s.id === id ? { ...s, scheduled_for } : s)),
      );
      void persist(id, scheduled_for);
    },
    [persist],
  );

  const setBucket = useCallback(
    async (id: string, bucket_id: number | null) => {
      setRows((prev) =>
        prev.map((s) => (s.id === id ? { ...s, bucket_id } : s)),
      );
      if (!supabase) return;
      await supabase.from("submissions").update({ bucket_id }).eq("id", id);
    },
    [supabase],
  );

  const patchRow = useCallback(
    async (id: string, patch: Partial<SubmissionRow>) => {
      setRows((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      );
      if (!supabase) return;
      await supabase.from("submissions").update(patch).eq("id", id);
    },
    [supabase],
  );

  const createNote = useCallback(
    async (text: string, scheduled_for: string) => {
      if (!supabase) return;
      const { data, error } = await supabase
        .from("submissions")
        .insert({
          url: null,
          status: "liked",
          comment: text,
          scheduled_for,
        })
        .select()
        .single();
      if (error || !data) return;
      const row = data as SubmissionRow;
      setRows((prev) => (prev.some((s) => s.id === row.id) ? prev : [row, ...prev]));
    },
    [supabase],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => (selectedId ? rows.find((r) => r.id === selectedId) ?? null : null),
    [selectedId, rows],
  );

  const onDragStart = (id: string) => (e: DragEvent<HTMLDivElement>) => {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = "move";
    // Setting any data unlocks DnD on Firefox.
    e.dataTransfer.setData("text/plain", id);
  };
  const onDragEnd = () => {
    setDraggingId(null);
    setDragOverKey(null);
  };
  const onDragOver = (key: string) => (e: DragEvent<HTMLDivElement>) => {
    if (!draggingId) return;
    e.preventDefault();
    if (dragOverKey !== key) setDragOverKey(key);
  };
  const onDrop = (target: string | null) => (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOverKey(null);
    if (!draggingId) return;
    const id = draggingId;
    setDraggingId(null);
    if (id === DRAFT_DRAG_ID) {
      // Dropping the empty pool card onto a day creates a free-form note.
      // Dropping back into the pool is a no-op (it's already there).
      if (target === null) return;
      const text = draftTextRef.current.trim();
      void createNote(text, target);
      setDraftText("");
      return;
    }
    const current = rows.find((r) => r.id === id);
    if (!current) return;
    if ((current.scheduled_for ?? null) === target) return;
    move(id, target);
  };

  const onDraftDragStart = (e: DragEvent<HTMLDivElement>) => {
    setDraggingId(DRAFT_DRAG_ID);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", DRAFT_DRAG_ID);
  };

  const pool = useMemo(
    () =>
      rows
        .filter((r) => r.status === "liked" && !r.scheduled_for)
        .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1)),
    [rows],
  );

  const grid = useMemo(() => buildMonthGrid(monthAnchor), [monthAnchor]);

  const dayMap = useMemo(() => {
    const map = new Map<string, SubmissionRow[]>();
    for (const r of rows) {
      if (!r.scheduled_for) continue;
      const list = map.get(r.scheduled_for) ?? [];
      list.push(r);
      map.set(r.scheduled_for, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.updated_at < b.updated_at ? -1 : 1));
    }
    return map;
  }, [rows]);

  const todayKey = dateKey(new Date());

  return (
    <section className="mt-14">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] mb-4">
        06 — Calendrier de publication
      </div>
      <p className="text-sm mb-6 max-w-2xl">
        Pool des submissions aimées à gauche. Drag-and-drop sur un jour pour planifier.
        Drag back vers le pool pour déplanifier. Tout sync en temps réel.
      </p>

      {!supabase && hydrated && (
        <div className="mb-4 text-xs rounded-2xl border border-red-500/40 bg-red-500/5 text-red-700 px-4 py-3">
          Supabase pas configuré — calendrier désactivé.
        </div>
      )}

      <div className="flex gap-4 flex-col lg:flex-row">
        <PoolColumn
          rows={pool}
          dragOverKey={dragOverKey}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragOver={onDragOver("__pool__")}
          onDrop={onDrop(null)}
          onSetBucket={setBucket}
          onOpen={setSelectedId}
          draftText={draftText}
          onDraftTextChange={setDraftText}
          onDraftDragStart={onDraftDragStart}
          onDraftDragEnd={onDragEnd}
          isDraftDragging={draggingId === DRAFT_DRAG_ID}
        />
        <div className="flex-1 min-w-0">
          <MonthHeader
            anchor={monthAnchor}
            onPrev={() => setMonthAnchor((d) => addMonths(d, -1))}
            onNext={() => setMonthAnchor((d) => addMonths(d, 1))}
            onToday={() => setMonthAnchor(firstOfMonth(new Date()))}
          />
          <div className="grid grid-cols-7 gap-px bg-charcoal/15 border border-charcoal/15 rounded-2xl">
            {DAY_HEADERS.map((d) => (
              <div
                key={d}
                className="bg-offwhite text-[10px] font-semibold uppercase tracking-[0.12em] py-2 text-center opacity-70"
              >
                {d}
              </div>
            ))}
            {grid.map((d) => {
              const key = dateKey(d);
              const inMonth = d.getMonth() === monthAnchor.getMonth();
              const isToday = key === todayKey;
              const cards = dayMap.get(key) ?? [];
              const isDragOver = dragOverKey === key;
              return (
                <div
                  key={key}
                  onDragOver={onDragOver(key)}
                  onDrop={onDrop(key)}
                  className={`bg-offwhite min-h-[120px] p-1.5 transition-colors ${
                    !inMonth ? "opacity-40" : ""
                  } ${isDragOver ? "bg-teal/15" : ""} ${
                    isToday ? "ring-2 ring-teal ring-inset" : ""
                  }`}
                >
                  <div className="flex items-center justify-between mb-1 px-1">
                    <span
                      className={`text-[10px] font-mono ${
                        isToday ? "text-teal font-semibold" : "opacity-60"
                      }`}
                    >
                      {d.getDate()}
                    </span>
                    {cards.length > 0 && (
                      <span className="text-[9px] opacity-50">{cards.length}</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    {cards.map((r) => (
                      <DayCard
                        key={r.id}
                        row={r}
                        isDragging={draggingId === r.id}
                        onDragStart={onDragStart(r.id)}
                        onDragEnd={onDragEnd}
                        onSetBucket={(bid) => setBucket(r.id, bid)}
                        onOpen={() => setSelectedId(r.id)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {selected && (
        <CardDetailModal
          row={selected}
          onClose={() => setSelectedId(null)}
          onPatch={(patch) => patchRow(selected.id, patch)}
        />
      )}
    </section>
  );
}

function MonthHeader({
  anchor,
  onPrev,
  onNext,
  onToday,
}: {
  anchor: Date;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  return (
    <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
      <div className="display-tight text-2xl">
        {MONTH_NAMES[anchor.getMonth()]} {anchor.getFullYear()}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrev}
          aria-label="Mois précédent"
          className="text-xs uppercase tracking-[0.1em] px-3 py-1.5 rounded-full border border-charcoal/30 hover:border-charcoal hover:bg-charcoal hover:text-offwhite transition-colors"
        >
          ←
        </button>
        <button
          type="button"
          onClick={onToday}
          className="text-xs uppercase tracking-[0.1em] px-3 py-1.5 rounded-full border border-charcoal/30 hover:border-teal hover:text-teal transition-colors"
        >
          Aujourd'hui
        </button>
        <button
          type="button"
          onClick={onNext}
          aria-label="Mois suivant"
          className="text-xs uppercase tracking-[0.1em] px-3 py-1.5 rounded-full border border-charcoal/30 hover:border-charcoal hover:bg-charcoal hover:text-offwhite transition-colors"
        >
          →
        </button>
      </div>
    </div>
  );
}

function PoolColumn({
  rows,
  dragOverKey,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onSetBucket,
  onOpen,
  draftText,
  onDraftTextChange,
  onDraftDragStart,
  onDraftDragEnd,
  isDraftDragging,
}: {
  rows: SubmissionRow[];
  dragOverKey: string | null;
  onDragStart: (id: string) => (e: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onDragOver: (e: DragEvent<HTMLDivElement>) => void;
  onDrop: (e: DragEvent<HTMLDivElement>) => void;
  onSetBucket: (id: string, bucket_id: number | null) => void;
  onOpen: (id: string) => void;
  draftText: string;
  onDraftTextChange: (next: string) => void;
  onDraftDragStart: (e: DragEvent<HTMLDivElement>) => void;
  onDraftDragEnd: () => void;
  isDraftDragging: boolean;
}) {
  const isOver = dragOverKey === "__pool__";
  return (
    <div
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`lg:w-72 lg:shrink-0 bg-charcoal text-offwhite rounded-2xl p-4 transition-colors ${
        isOver ? "ring-2 ring-teal" : ""
      }`}
    >
      <div className="flex items-baseline justify-between mb-3">
        <div className="text-teal text-[10px] font-semibold uppercase tracking-[0.14em]">
          À placer
        </div>
        <div className="text-[10px] opacity-50">{rows.length}</div>
      </div>
      <div className="flex flex-col gap-2">
        <DraftCard
          text={draftText}
          onChange={onDraftTextChange}
          onDragStart={onDraftDragStart}
          onDragEnd={onDraftDragEnd}
          isDragging={isDraftDragging}
        />
        {rows.length === 0 ? (
          <p className="text-xs italic opacity-50 mt-1">
            Aime des submissions ci-dessus, elles apparaîtront ici. Ou écris une note dans la carte au-dessus.
          </p>
        ) : (
          rows.map((r) => (
            <PoolCard
              key={r.id}
              row={r}
              onDragStart={onDragStart(r.id)}
              onDragEnd={onDragEnd}
              onSetBucket={(bid) => onSetBucket(r.id, bid)}
              onOpen={() => onOpen(r.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function DraftCard({
  text,
  onChange,
  onDragStart,
  onDragEnd,
  isDragging,
}: {
  text: string;
  onChange: (next: string) => void;
  onDragStart: (e: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  isDragging: boolean;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      title="Écris une note, puis glisse cette carte sur un jour du calendrier."
      className={`group flex gap-2 bg-offwhite/[0.04] hover:bg-offwhite/[0.07] border border-dashed border-offwhite/25 rounded-xl p-2 cursor-grab active:cursor-grabbing transition-colors ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <div className="shrink-0 w-14 h-14 rounded-md bg-offwhite/10 border border-offwhite/10 flex items-center justify-center text-offwhite/40 text-base">
        ✎
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[9px] uppercase tracking-[0.14em] text-teal/80 font-semibold">
            Note libre
          </span>
          <span className="text-[9px] opacity-40 group-hover:opacity-70 transition-opacity">
            ⇢ glisser
          </span>
        </div>
        <textarea
          value={text}
          onChange={(e) => onChange(e.target.value)}
          draggable={false}
          onDragStart={(e) => e.stopPropagation()}
          placeholder="Idée, shoot, todo… glisse vers un jour."
          rows={2}
          className="w-full bg-transparent text-[11px] resize-none outline-none placeholder:opacity-40 leading-snug"
        />
      </div>
    </div>
  );
}

function PoolCard({
  row,
  onDragStart,
  onDragEnd,
  onSetBucket,
  onOpen,
}: {
  row: SubmissionRow;
  onDragStart: (e: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onSetBucket: (bucket_id: number | null) => void;
  onOpen: () => void;
}) {
  const isNote = !row.url;
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      className="flex gap-2 bg-offwhite/5 hover:bg-offwhite/10 border border-offwhite/10 rounded-xl p-2 cursor-grab active:cursor-grabbing transition-colors"
    >
      {isNote ? (
        <div className="shrink-0 w-14 h-14 rounded-md bg-offwhite/10 border border-offwhite/10 flex items-center justify-center text-offwhite/40 text-base">
          ✎
        </div>
      ) : (
        <Thumb url={row.url as string} size={56} />
      )}
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          {isNote ? (
            <span className="text-[9px] uppercase tracking-[0.14em] text-teal/80 font-semibold">
              Note
            </span>
          ) : (
            <a
              href={row.url as string}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              onDragStart={(e) => e.stopPropagation()}
              draggable={false}
              className="text-[10px] font-mono break-all hover:text-teal opacity-80 min-w-0"
            >
              {(row.url as string).replace(/^https?:\/\/(www\.)?instagram\.com\//, "")}
            </a>
          )}
          {row.production_status && (
            <span
              className={`shrink-0 text-[8px] font-bold uppercase tracking-[0.08em] px-1.5 py-0.5 rounded ${STATUS_BADGE_CLS[row.production_status]}`}
            >
              {PRODUCTION_STATUS_LABEL[row.production_status]}
            </span>
          )}
        </div>
        {row.comment && (
          <p className={`text-[11px] line-clamp-2 ${isNote ? "opacity-90" : "opacity-70"}`}>
            {row.comment}
          </p>
        )}
        <div className="mt-auto pt-1">
          <BucketPicker value={row.bucket_id} onChange={onSetBucket} />
        </div>
      </div>
    </div>
  );
}

function DayCard({
  row,
  isDragging,
  onDragStart,
  onDragEnd,
  onSetBucket,
  onOpen,
}: {
  row: SubmissionRow;
  isDragging: boolean;
  onDragStart: (e: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onSetBucket: (bucket_id: number | null) => void;
  onOpen: () => void;
}) {
  const isNote = !row.url;
  const bucket = row.bucket_id != null ? buckets.find((b) => b.id === row.bucket_id) : null;
  const status = row.production_status;
  const tooltip = [
    isNote ? "Note" : row.url,
    bucket ? `Bucket #${bucket.id} — ${bucket.name}` : null,
    status ? `Status: ${PRODUCTION_STATUS_LABEL[status]}` : null,
    row.comment || null,
  ]
    .filter(Boolean)
    .join("\n\n");
  const label = isNote
    ? row.comment.trim() || "Note vide"
    : (row.url as string).replace(/^https?:\/\/(www\.)?instagram\.com\/(p|reel|tv)\//, "");
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      title={tooltip}
      className={`flex items-center gap-1.5 bg-charcoal text-offwhite rounded-md p-1 cursor-grab active:cursor-grabbing transition-opacity ${
        isDragging ? "opacity-30" : ""
      }`}
    >
      <span
        className={`shrink-0 w-1.5 h-7 rounded-sm ${
          status ? STATUS_DOT_CLS[status] : "bg-offwhite/20"
        }`}
        aria-label={status ? PRODUCTION_STATUS_LABEL[status] : "Aucun status"}
      />
      {isNote ? (
        <span className="shrink-0 w-7 h-7 rounded bg-offwhite/10 flex items-center justify-center text-offwhite/50 text-[11px]">
          ✎
        </span>
      ) : (
        <Thumb url={row.url as string} size={28} compact />
      )}
      <span
        className={`text-[9px] truncate flex-1 min-w-0 ${
          isNote ? "opacity-90" : "font-mono opacity-70"
        }`}
      >
        {label}
      </span>
      <BucketPicker value={row.bucket_id} onChange={onSetBucket} compact />
    </div>
  );
}

function CardDetailModal({
  row,
  onClose,
  onPatch,
}: {
  row: SubmissionRow;
  onClose: () => void;
  onPatch: (patch: Partial<SubmissionRow>) => void;
}) {
  const [comment, setComment] = useState(row.comment);
  const onPatchRef = useRef(onPatch);
  useEffect(() => {
    onPatchRef.current = onPatch;
  }, [onPatch]);

  // Reset local comment when switching to a different row.
  useEffect(() => {
    setComment(row.comment);
  }, [row.id, row.comment]);

  // Debounced comment save.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCommentChange = (next: string) => {
    setComment(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onPatchRef.current({ comment: next });
    }, 500);
  };

  // Flush pending comment on unmount.
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const bucket = row.bucket_id != null ? buckets.find((b) => b.id === row.bucket_id) : null;

  return (
    <div
      className="fixed inset-0 z-[60] bg-charcoal/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-offwhite rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 md:p-5 border-b border-charcoal/10">
          <div className="text-[10px] uppercase tracking-[0.14em] opacity-60">
            Détail · post
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="text-2xl leading-none px-2 opacity-50 hover:opacity-100 transition-opacity"
          >
            ×
          </button>
        </div>

        <div className="p-4 md:p-5 flex flex-col md:flex-row gap-4 border-b border-charcoal/10">
          <div className="shrink-0">
            {row.url ? (
              <Thumb url={row.url} size={160} />
            ) : (
              <div className="w-[160px] h-[160px] rounded-md bg-charcoal/10 border border-charcoal/15 flex items-center justify-center text-charcoal/40 text-3xl">
                ✎
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 flex flex-col gap-3">
            {row.url ? (
              <a
                href={row.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs break-all hover:text-teal transition-colors"
              >
                → {row.url.replace(/^https?:\/\/(www\.)?/, "")}
              </a>
            ) : (
              <div className="text-[10px] uppercase tracking-[0.14em] text-teal font-semibold">
                Note libre · pas d'URL
              </div>
            )}

            <div>
              <div className="text-[10px] uppercase tracking-[0.12em] opacity-60 mb-1.5">
                Status de production
              </div>
              <div className="flex gap-1 flex-wrap">
                {PRODUCTION_STATUSES.map((s) => {
                  const active = row.production_status === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => onPatch({ production_status: active ? null : s })}
                      className={`text-[10px] uppercase tracking-[0.08em] font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                        active
                          ? `${STATUS_BADGE_CLS[s]} border-transparent`
                          : "border-charcoal/25 hover:border-charcoal hover:bg-charcoal hover:text-offwhite"
                      }`}
                    >
                      {PRODUCTION_STATUS_LABEL[s]}
                    </button>
                  );
                })}
                {row.production_status && (
                  <button
                    type="button"
                    onClick={() => onPatch({ production_status: null })}
                    className="text-[10px] uppercase tracking-[0.08em] px-2 py-1 rounded-full opacity-50 hover:opacity-100"
                  >
                    × clear
                  </button>
                )}
              </div>
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-[0.12em] opacity-60 mb-1.5">
                Bucket
              </div>
              <div className="flex gap-1 flex-wrap">
                {buckets.map((b) => {
                  const active = row.bucket_id === b.id;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => onPatch({ bucket_id: active ? null : b.id })}
                      className={`text-[10px] uppercase tracking-[0.08em] px-2.5 py-1 rounded-full border transition-colors ${
                        active
                          ? "bg-teal text-charcoal border-teal font-semibold"
                          : "border-charcoal/25 hover:border-teal hover:text-teal"
                      }`}
                    >
                      #{b.id} {b.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-[11px] opacity-70">
                {row.scheduled_for ? (
                  <>Planifié pour <span className="font-semibold">{row.scheduled_for}</span></>
                ) : (
                  <>Dans le pool · pas encore placé</>
                )}
              </div>
              {row.scheduled_for && (
                <button
                  type="button"
                  onClick={() => onPatch({ scheduled_for: null })}
                  className="text-[10px] uppercase tracking-[0.08em] px-3 py-1.5 rounded-full border border-charcoal/30 hover:border-charcoal hover:bg-charcoal hover:text-offwhite transition-colors"
                >
                  ↩ Retour pool
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 md:p-5">
          <div className="text-[10px] uppercase tracking-[0.12em] opacity-60 mb-1.5">
            Commentaires
          </div>
          <textarea
            value={comment}
            onChange={(e) => onCommentChange(e.target.value)}
            placeholder="Notes, idées de caption, choses à coordonner avec MN…"
            rows={5}
            className="w-full bg-transparent border border-charcoal/15 rounded-xl p-3 text-sm resize-y outline-none focus:border-teal placeholder:opacity-40"
          />
          {bucket?.description && (
            <p className="text-[11px] opacity-50 mt-3">
              <span className="font-semibold">Rappel bucket #{bucket.id} :</span>{" "}
              {bucket.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function BucketPicker({
  value,
  onChange,
  compact = false,
}: {
  value: number | null;
  onChange: (bucket_id: number | null) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const current = value != null ? buckets.find((b) => b.id === value) : null;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const trigger = compact ? (
    <button
      type="button"
      draggable={false}
      onDragStart={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        setOpen((o) => !o);
      }}
      className={`shrink-0 text-[8px] font-bold px-1 py-0.5 rounded ${
        current
          ? "bg-teal text-charcoal"
          : "bg-offwhite/15 text-offwhite/60 hover:bg-offwhite/25"
      }`}
      aria-label={current ? `Bucket ${current.id} — ${current.name}` : "Assigner un bucket"}
    >
      {current ? `#${current.id}` : "+"}
    </button>
  ) : (
    <button
      type="button"
      draggable={false}
      onDragStart={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        setOpen((o) => !o);
      }}
      className={`text-[10px] uppercase tracking-[0.08em] px-2 py-1 rounded-full transition-colors w-full text-left truncate ${
        current
          ? "bg-teal text-charcoal font-semibold"
          : "border border-offwhite/20 text-offwhite/60 hover:border-teal hover:text-teal"
      }`}
    >
      {current ? `#${current.id} ${current.name}` : "+ assigner un bucket"}
    </button>
  );

  return (
    <div ref={ref} className="relative">
      {trigger}
      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 min-w-[180px] bg-charcoal text-offwhite border border-offwhite/15 rounded-lg shadow-xl py-1 max-h-64 overflow-y-auto">
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
              setOpen(false);
            }}
            className="block w-full text-left px-3 py-1.5 text-[11px] hover:bg-offwhite/10 opacity-60"
          >
            Aucun bucket
          </button>
          <div className="border-t border-offwhite/10 my-1" />
          {buckets.map((b) => {
            const selected = value === b.id;
            return (
              <button
                key={b.id}
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(b.id);
                  setOpen(false);
                }}
                className={`block w-full text-left px-3 py-1.5 text-[11px] hover:bg-offwhite/10 ${
                  selected ? "text-teal font-semibold" : ""
                }`}
              >
                #{b.id} {b.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Thumb({ url, size, compact = false }: { url: string; size: number; compact?: boolean }) {
  const [broken, setBroken] = useState(false);
  const handleErr = (e: SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.style.display = "none";
    setBroken(true);
  };
  return (
    <div
      style={{ width: size, height: size }}
      className={`shrink-0 rounded ${compact ? "" : "rounded-md"} overflow-hidden bg-offwhite/10 relative`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/ig-thumbnail?url=${encodeURIComponent(url)}`}
        alt=""
        loading="lazy"
        onError={handleErr}
        draggable={false}
        className="w-full h-full object-cover"
      />
      {broken && (
        <div className="absolute inset-0 flex items-center justify-center text-[8px] opacity-50">
          IG
        </div>
      )}
    </div>
  );
}
