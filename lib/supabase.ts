"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type ProductionStatus = "draft" | "shot" | "edited" | "posted";
export const PRODUCTION_STATUSES: ProductionStatus[] = ["draft", "shot", "edited", "posted"];
export const PRODUCTION_STATUS_LABEL: Record<ProductionStatus, string> = {
  draft: "Draft",
  shot: "Shot",
  edited: "Edited",
  posted: "Posted",
};

export type ArtistVideoStatus = "pending" | "approved" | "changes_requested" | "rejected";
export type ArtistVideoRow = {
  id: string;
  storage_path: string;
  original_filename: string | null;
  artist_note: string;
  planner_comment: string;
  status: ArtistVideoStatus;
  created_at: string;
  updated_at: string;
};

export type SubmissionRow = {
  id: string;
  // Null for free-form note cards created from the calendar pool's empty card.
  url: string | null;
  status: "pending" | "liked" | "refused";
  comment: string;
  scheduled_for: string | null; // YYYY-MM-DD, null if not yet placed on calendar
  bucket_id: number | null; // references the bucket id in lib/content.ts
  production_status: ProductionStatus | null;
  created_at: string;
  updated_at: string;
};

let client: SupabaseClient | null = null;
let warned = false;

export function getSupabase(): SupabaseClient | null {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    if (!warned && typeof window !== "undefined") {
      warned = true;
      console.warn(
        "[supabase] missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. The submission queue is disabled.",
      );
    }
    return null;
  }
  client = createClient(url, key, {
    auth: { persistSession: false },
  });
  return client;
}
