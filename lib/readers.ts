import { supabase } from "@/lib/supabase";

export const READER_PAGE_SIZE = 20;
export const READER_COLUMNS = "user_id,display_name,bio,is_public,show_activity,created_at,follower_count,following_count,avatar_path";
export type Reader = {
  user_id: string;
  display_name: string;
  bio: string;
  is_public: boolean;
  show_activity: boolean;
  created_at: string;
  follower_count: number;
  following_count: number;
  avatar_path: string | null;
};
export type ReaderBook = { id: string; external_id: string; title: string; author: string | null; cover_url: string | null };
export type ReaderActivity = {
  id: string;
  kind: "rating" | "discussion";
  created_at: string;
  content: string | null;
  contains_spoilers: boolean;
  overall_rating?: number;
  books: ReaderBook | null;
};

export function validReaderId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
export function readerHref(id: string) { return `/readers/${encodeURIComponent(id)}`; }
export function escapedReaderSearch(value: string) { return value.trim().slice(0, 80).replace(/[\\%_]/g, "\\$&"); }

export async function currentReaderId() {
  const { data } = await supabase.auth.getUser();
  return data.user && !data.user.is_anonymous ? data.user.id : null;
}

export async function searchReaders(query: string, offset = 0, signal?: AbortSignal) {
  let request = supabase.from("reader_cards").select(READER_COLUMNS)
    .eq("is_public", true).ilike("display_name", `%${escapedReaderSearch(query)}%`)
    .order("display_name").order("user_id").range(offset, offset + READER_PAGE_SIZE - 1);
  if (signal) request = request.abortSignal(signal);
  const { data, error } = await request;
  if (error) throw error;
  return (data || []) as Reader[];
}

export async function getReader(id: string, signal?: AbortSignal) {
  if (!validReaderId(id)) return null;
  let request = supabase.from("reader_cards").select(READER_COLUMNS).eq("user_id", id);
  if (signal) request = request.abortSignal(signal);
  const { data, error } = await request.maybeSingle();
  if (error) throw error;
  return data as Reader | null;
}

export async function followedReaders(viewerId: string | null, targetIds: string[], signal?: AbortSignal) {
  if (!viewerId || targetIds.length === 0) return new Set<string>();
  let request = supabase.from("reader_follows").select("following_id")
    .eq("follower_id", viewerId).in("following_id", targetIds);
  if (signal) request = request.abortSignal(signal);
  const { data, error } = await request;
  if (error) throw error;
  return new Set((data || []).map((row: { following_id: string }) => row.following_id));
}

export async function setReaderFollowing(viewerId: string, targetId: string, following: boolean) {
  if (!validReaderId(viewerId) || !validReaderId(targetId) || viewerId === targetId) throw new Error("Invalid reader connection");
  const request = following
    ? supabase.from("reader_follows").insert({ follower_id: viewerId, following_id: targetId })
    : supabase.from("reader_follows").delete().eq("follower_id", viewerId).eq("following_id", targetId);
  const { error } = await request;
  if (error && !(following && error.code === "23505")) throw error;
}

export async function readerConnections(id: string, direction: "followers" | "following", offset = 0, signal?: AbortSignal) {
  const ownColumn = direction === "followers" ? "following_id" : "follower_id";
  const otherColumn = direction === "followers" ? "follower_id" : "following_id";
  let request = supabase.from("reader_follows").select(otherColumn).eq(ownColumn, id)
    .order("created_at", { ascending: false }).order(otherColumn)
    .range(offset, offset + READER_PAGE_SIZE - 1);
  if (signal) request = request.abortSignal(signal);
  const { data, error } = await request;
  if (error) throw error;
  const rows = (data || []) as unknown as Record<string, string>[];
  if (!rows.length) return { readers: [] as Reader[], hasMore: false };
  const ids = rows.map((row) => row[otherColumn]);
  let profilesRequest = supabase.from("reader_cards").select(READER_COLUMNS).in("user_id", ids).eq("is_public", true);
  if (signal) profilesRequest = profilesRequest.abortSignal(signal);
  const result = await profilesRequest;
  if (result.error) throw result.error;
  const profiles = new Map(((result.data || []) as Reader[]).map((reader) => [reader.user_id, reader]));
  return { readers: ids.flatMap((userId) => profiles.get(userId) ? [profiles.get(userId)!] : []), hasMore: rows.length === READER_PAGE_SIZE };
}

export async function readerActivity(reader: Reader, signal?: AbortSignal) {
  if (!reader.show_activity) return [];
  const fields = "id,content,contains_spoilers,created_at,books(id,external_id,title,author,cover_url)";
  let ratings = supabase.from("ratings").select(`${fields},overall_rating`).eq("user_id", reader.user_id).order("created_at", { ascending: false }).limit(20);
  let discussions = supabase.from("discussion_posts").select(fields).eq("user_id", reader.user_id).order("created_at", { ascending: false }).limit(20);
  if (signal) { ratings = ratings.abortSignal(signal); discussions = discussions.abortSignal(signal); }
  const [ratingResult, discussionResult] = await Promise.all([ratings, discussions]);
  if (ratingResult.error) throw ratingResult.error;
  if (discussionResult.error) throw discussionResult.error;
  return [
    ...(ratingResult.data || []).map((row) => ({ ...row, kind: "rating" as const })),
    ...(discussionResult.data || []).map((row) => ({ ...row, kind: "discussion" as const })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 30) as unknown as ReaderActivity[];
}

export async function updateReaderVisibility(userId: string, isPublic: boolean, showActivity: boolean) {
  const { data, error } = await supabase.from("reader_profiles")
    .update({ is_public: isPublic, show_activity: showActivity }).eq("user_id", userId)
    .select("user_id").single();
  if (error) throw error;
  if (!data) throw new Error("Reader profile unavailable");
}
