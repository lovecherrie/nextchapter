import { supabase } from "./supabase";

export type BuddyBook = { id: string; external_id: string | null; title: string; author: string | null; cover_url: string | null };
export type BuddyRead = { id: string; owner_id: string; title: string; created_at: string; books: BuddyBook | null };
export type BuddyMember = { user_id: string; display_name: string; joined_at: string };
export type BuddyMessage = { id: string; user_id: string; display_name: string; chapter: number; content: string; created_at: string };
export const BUDDY_FIELDS = "id,owner_id,title,created_at,books(id,external_id,title,author,cover_url)";
export const buddyHref = (id: string) => `/buddy-reads/${encodeURIComponent(id)}`;
export const validBuddyId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export async function buddyList(userId: string, signal: AbortSignal): Promise<BuddyRead[]> {
  const { data, error } = await supabase.from("buddy_read_members").select("read_id").eq("user_id", userId).order("joined_at", { ascending: false }).limit(100).abortSignal(signal);
  if (error) throw error;
  const ids = (data || []).map((row) => row.read_id);
  if (!ids.length) return [];
  const result = await supabase.from("buddy_reads").select(BUDDY_FIELDS).in("id", ids).order("created_at", { ascending: false }).abortSignal(signal);
  if (result.error) throw result.error;
  return (result.data || []) as unknown as BuddyRead[];
}
