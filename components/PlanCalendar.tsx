"use client";

import { useCallback, useEffect, useMemo, useState, type DragEvent, type SyntheticEvent } from "react";
import { getSupabase, type SubmissionRow } from "@/lib/supabase";

const MONTH_NAMES = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];
const DAY_HEADERS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

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
    const current = rows.find((r) => r.id === id);
    if (!current) return;
    if ((current.scheduled_for ?? null) === target) return;
    move(id, target);
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
        />
        <div className="flex-1 min-w-0">
          <MonthHeader
            anchor={monthAnchor}
            onPrev={() => setMonthAnchor((d) => addMonths(d, -1))}
            onNext={() => setMonthAnchor((d) => addMonths(d, 1))}
            onToday={() => setMonthAnchor(firstOfMonth(new Date()))}
          />
          <div className="grid grid-cols-7 gap-px bg-charcoal/15 border border-charcoal/15 rounded-2xl overflow-hidden">
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
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
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
}: {
  rows: SubmissionRow[];
  dragOverKey: string | null;
  onDragStart: (id: string) => (e: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onDragOver: (e: DragEvent<HTMLDivElement>) => void;
  onDrop: (e: DragEvent<HTMLDivElement>) => void;
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
      {rows.length === 0 ? (
        <p className="text-xs italic opacity-50">
          Aime des submissions ci-dessus, elles apparaîtront ici.
        </p>
      ) : (
        <div className="flex flex-col gap-2 max-h-[600px] overflow-y-auto pr-1">
          {rows.map((r) => (
            <PoolCard
              key={r.id}
              row={r}
              onDragStart={onDragStart(r.id)}
              onDragEnd={onDragEnd}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PoolCard({
  row,
  onDragStart,
  onDragEnd,
}: {
  row: SubmissionRow;
  onDragStart: (e: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="flex gap-2 bg-offwhite/5 hover:bg-offwhite/10 border border-offwhite/10 rounded-xl p-2 cursor-grab active:cursor-grabbing transition-colors"
    >
      <Thumb url={row.url} size={56} />
      <div className="flex-1 min-w-0 flex flex-col">
        <a
          href={row.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          onDragStart={(e) => e.stopPropagation()}
          draggable={false}
          className="text-[10px] font-mono break-all hover:text-teal opacity-80"
        >
          {row.url.replace(/^https?:\/\/(www\.)?instagram\.com\//, "")}
        </a>
        {row.comment && (
          <p className="text-[11px] opacity-70 mt-1 line-clamp-2">{row.comment}</p>
        )}
      </div>
    </div>
  );
}

function DayCard({
  row,
  isDragging,
  onDragStart,
  onDragEnd,
}: {
  row: SubmissionRow;
  isDragging: boolean;
  onDragStart: (e: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
}) {
  const tooltip = row.comment
    ? `${row.url}\n\n${row.comment}`
    : row.url;
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      title={tooltip}
      className={`flex items-center gap-1.5 bg-charcoal text-offwhite rounded-md p-1 cursor-grab active:cursor-grabbing transition-opacity ${
        isDragging ? "opacity-30" : ""
      }`}
    >
      <Thumb url={row.url} size={28} compact />
      <span className="text-[9px] font-mono truncate opacity-70 flex-1 min-w-0">
        {row.url.replace(/^https?:\/\/(www\.)?instagram\.com\/(p|reel|tv)\//, "")}
      </span>
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
