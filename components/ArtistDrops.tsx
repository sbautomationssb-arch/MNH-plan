"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import {
  getSupabase,
  type ArtistVideoRow,
  type ArtistVideoStatus,
} from "@/lib/supabase";

const STATUS_LABEL: Record<ArtistVideoStatus, string> = {
  pending: "À review",
  approved: "Approuvé",
  changes_requested: "Changements demandés",
  rejected: "Refusé",
};

const STATUS_BADGE: Record<ArtistVideoStatus, string> = {
  pending: "bg-charcoal/15 text-charcoal",
  approved: "bg-teal text-charcoal",
  changes_requested: "bg-orange-400 text-charcoal",
  rejected: "bg-charcoal text-offwhite",
};

const STATUSES: ArtistVideoStatus[] = [
  "pending",
  "approved",
  "changes_requested",
  "rejected",
];

export function ArtistDrops() {
  const supabase = useMemo(() => getSupabase(), []);
  const [hydrated, setHydrated] = useState(false);
  const [rows, setRows] = useState<ArtistVideoRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [draftNote, setDraftNote] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHydrated(true);
    if (!supabase) return;
    let cancelled = false;
    supabase
      .from("artist_videos")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled || error) return;
        setRows((data ?? []) as ArtistVideoRow[]);
      });
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel("artist_videos-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "artist_videos" },
        (payload) => {
          setRows((prev) => {
            if (payload.eventType === "INSERT") {
              const row = payload.new as ArtistVideoRow;
              if (prev.some((r) => r.id === row.id)) return prev;
              return [row, ...prev];
            }
            if (payload.eventType === "UPDATE") {
              const row = payload.new as ArtistVideoRow;
              return prev.map((r) => (r.id === row.id ? row : r));
            }
            if (payload.eventType === "DELETE") {
              const old = payload.old as Partial<ArtistVideoRow>;
              return prev.filter((r) => r.id !== old.id);
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

  const handleUpload = useCallback(
    async (file: File) => {
      if (!supabase) {
        setUploadError("Supabase pas configuré.");
        return;
      }
      setUploading(true);
      setUploadError(null);
      try {
        const ext = file.name.includes(".") ? file.name.split(".").pop() : "mp4";
        const path = `${crypto.randomUUID()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("artist-videos")
          .upload(path, file, {
            contentType: file.type || "video/mp4",
            upsert: false,
          });
        if (uploadErr) throw uploadErr;
        const { error: insertErr } = await supabase
          .from("artist_videos")
          .insert({
            storage_path: path,
            original_filename: file.name,
            artist_note: draftNote,
          });
        if (insertErr) throw insertErr;
        setDraftNote("");
        if (fileInputRef.current) fileInputRef.current.value = "";
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erreur d'upload.";
        setUploadError(msg);
      } finally {
        setUploading(false);
      }
    },
    [supabase, draftNote],
  );

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleUpload(file);
  };

  const setStatus = useCallback(
    async (id: string, status: ArtistVideoStatus) => {
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
      if (!supabase) return;
      await supabase.from("artist_videos").update({ status }).eq("id", id);
    },
    [supabase],
  );

  const commentTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const setComment = useCallback(
    (id: string, planner_comment: string) => {
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, planner_comment } : r)),
      );
      if (!supabase) return;
      const map = commentTimers.current;
      const existing = map.get(id);
      if (existing) clearTimeout(existing);
      const t = setTimeout(async () => {
        await supabase
          .from("artist_videos")
          .update({ planner_comment })
          .eq("id", id);
        map.delete(id);
      }, 500);
      map.set(id, t);
    },
    [supabase],
  );

  useEffect(() => {
    const map = commentTimers.current;
    return () => {
      map.forEach((t) => clearTimeout(t));
      map.clear();
    };
  }, []);

  const remove = useCallback(
    async (row: ArtistVideoRow) => {
      if (!supabase) return;
      const label = row.original_filename ?? row.storage_path;
      if (!confirm(`Supprimer "${label}" ?`)) return;
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      await supabase.storage.from("artist-videos").remove([row.storage_path]);
      await supabase.from("artist_videos").delete().eq("id", row.id);
    },
    [supabase],
  );

  const publicUrl = useCallback(
    (path: string) => {
      if (!supabase) return "";
      return supabase.storage.from("artist-videos").getPublicUrl(path).data.publicUrl;
    },
    [supabase],
  );

  return (
    <section className="mt-14">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] mb-4">
        07 — Drops de Marie-Neiges
      </div>
      <p className="text-sm mb-6 max-w-2xl">
        MN balance ses vidéos ici (drafts, finis, à review). Tu reviews,
        commentes, approuves ou demandes des changements. Tout sync en temps
        réel.
      </p>

      {!supabase && hydrated && (
        <div className="mb-4 text-xs rounded-2xl border border-red-500/40 bg-red-500/5 text-red-700 px-4 py-3">
          Supabase pas configuré — drops désactivés.
        </div>
      )}

      <div className="bg-charcoal text-offwhite rounded-3xl p-5 md:p-6 mb-6">
        <div className="text-teal text-[10px] font-semibold uppercase tracking-[0.14em] mb-3">
          Drop une vidéo
        </div>
        <textarea
          value={draftNote}
          onChange={(e) => setDraftNote(e.target.value)}
          placeholder="Note optionnelle (contexte, version, ce que tu veux feedback dessus…)"
          rows={2}
          className="w-full bg-transparent text-offwhite placeholder:text-offwhite/30 text-sm border-b border-offwhite/15 pb-2 mb-3 outline-none resize-none focus:border-teal"
        />
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={onFileChange}
            disabled={uploading || !supabase}
            className="text-xs text-offwhite/70 file:mr-3 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[11px] file:uppercase file:tracking-[0.12em] file:font-semibold file:bg-teal file:text-charcoal hover:file:opacity-90 file:cursor-pointer disabled:opacity-30"
          />
          {uploading && <span className="text-[11px] text-teal">Uploading…</span>}
        </div>
        {uploadError && (
          <p className="text-[11px] text-red-300 mt-3">Erreur : {uploadError}</p>
        )}
      </div>

      {hydrated && supabase && rows.length === 0 && (
        <div className="text-sm opacity-50 italic">
          Aucun drop encore. MN va commencer à pousser ses vidéos ici.
        </div>
      )}

      {hydrated && rows.length > 0 && (
        <div className="space-y-4">
          {rows.map((r) => (
            <DropCard
              key={r.id}
              row={r}
              videoUrl={publicUrl(r.storage_path)}
              onSetStatus={(s) => setStatus(r.id, s)}
              onSetComment={(c) => setComment(r.id, c)}
              onRemove={() => remove(r)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function DropCard({
  row,
  videoUrl,
  onSetStatus,
  onSetComment,
  onRemove,
}: {
  row: ArtistVideoRow;
  videoUrl: string;
  onSetStatus: (s: ArtistVideoStatus) => void;
  onSetComment: (c: string) => void;
  onRemove: () => void;
}) {
  const created = new Date(row.created_at);
  const dateLabel = `${created.toLocaleDateString("fr-CA")} · ${created.toLocaleTimeString(
    "fr-CA",
    { hour: "2-digit", minute: "2-digit" },
  )}`;
  return (
    <div className="bg-offwhite border border-charcoal/15 rounded-3xl overflow-hidden">
      <div className="flex flex-col md:flex-row">
        <div className="md:w-[40%] bg-charcoal flex items-center justify-center">
          <video
            src={videoUrl}
            controls
            preload="metadata"
            className="w-full h-full max-h-[60vh] object-contain"
          />
        </div>
        <div className="flex-1 p-5 md:p-6 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0 flex flex-col">
              {row.original_filename && (
                <div className="text-xs font-mono opacity-70 break-all">
                  {row.original_filename}
                </div>
              )}
              <div className="text-[10px] uppercase tracking-[0.12em] opacity-50 mt-0.5">
                {dateLabel}
              </div>
            </div>
            <span
              className={`shrink-0 text-[10px] font-bold uppercase tracking-[0.08em] px-2.5 py-1 rounded-full ${STATUS_BADGE[row.status]}`}
            >
              {STATUS_LABEL[row.status]}
            </span>
          </div>

          {row.artist_note && (
            <div className="bg-charcoal/[0.04] border-l-2 border-teal pl-3 py-2 text-sm">
              <div className="text-[10px] uppercase tracking-[0.12em] opacity-60 mb-1">
                Note de MN
              </div>
              {row.artist_note}
            </div>
          )}

          <div>
            <div className="text-[10px] uppercase tracking-[0.12em] opacity-60 mb-1.5">
              Status
            </div>
            <div className="flex gap-1 flex-wrap">
              {STATUSES.map((s) => {
                const active = row.status === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => onSetStatus(s)}
                    className={`text-[10px] uppercase tracking-[0.08em] px-2.5 py-1 rounded-full border transition-colors ${
                      active
                        ? `${STATUS_BADGE[s]} border-transparent font-semibold`
                        : "border-charcoal/25 hover:border-charcoal hover:bg-charcoal hover:text-offwhite"
                    }`}
                  >
                    {STATUS_LABEL[s]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1">
            <div className="text-[10px] uppercase tracking-[0.12em] opacity-60 mb-1.5">
              Ton commentaire
            </div>
            <textarea
              value={row.planner_comment}
              onChange={(e) => onSetComment(e.target.value)}
              placeholder="Feedback, suggestions, références…"
              rows={4}
              className="w-full bg-transparent border border-charcoal/15 rounded-xl p-3 text-sm resize-y outline-none focus:border-teal placeholder:opacity-40"
            />
          </div>

          <div className="flex items-center justify-end mt-auto">
            <button
              type="button"
              onClick={onRemove}
              className="text-[10px] uppercase tracking-[0.08em] opacity-40 hover:opacity-100 hover:text-red-700 transition-colors"
            >
              Supprimer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
