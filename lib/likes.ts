import { supabase } from "./supabase";

// The desired state is idempotent: retrying a slow save cannot duplicate a like.
// Both tables enforce one like per reader and target in the database.
export async function saveLike(table: "discussion_likes" | "comment_likes", targetId: string, userId: string, liked: boolean) {
  const key = table === "discussion_likes" ? "post_id" : "comment_id";
  const request = liked
    ? supabase.from(table).upsert({ [key]: targetId, user_id: userId }, { onConflict: `${key},user_id`, ignoreDuplicates: true })
    : supabase.from(table).delete().eq(key, targetId).eq("user_id", userId);
  const { error } = await request.abortSignal(AbortSignal.timeout(10000));
  if (error) throw error;
}
