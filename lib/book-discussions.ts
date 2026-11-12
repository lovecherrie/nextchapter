import { supabase } from "./supabase";

type Count = { count: number }[] | { count: number } | null;
type Row = { id: string; discussion_likes: Count; comments: Count; [key: string]: unknown };
const count = (value: Count) => Number((Array.isArray(value) ? value[0] : value)?.count || 0);

export async function loadBookDiscussions(bookId: string, viewerId: string | null) {
  const signal = AbortSignal.timeout(10000);
  const related = await supabase.from("book_polls").select("post_id").eq("right_book_id", bookId).abortSignal(signal);
  if (related.error) throw related.error;
  const pollIds = (related.data || []).map((poll) => poll.post_id);
  // Embedded counts avoid three additional requests for every discussion.
  let request = supabase.from("discussion_posts").select("*,book_polls(post_id),discussion_likes(count),comments(count)");
  request = pollIds.length ? request.or(`book_id.eq.${bookId},id.in.(${pollIds.join(",")})`) : request.eq("book_id", bookId);
  const result = await request.abortSignal(signal);
  if (result.error) throw result.error;
  const rows = (result.data || []) as Row[];
  const liked = new Set<string>();
  if (viewerId) {
    // Bound URL length even on books with many discussions.
    for (let start = 0; start < rows.length; start += 100) {
      const ownLikes = await supabase.from("discussion_likes").select("post_id")
        .eq("user_id", viewerId).in("post_id", rows.slice(start, start + 100).map((row) => row.id)).abortSignal(signal);
      if (ownLikes.error) throw ownLikes.error;
      for (const like of ownLikes.data || []) liked.add(like.post_id);
    }
  }
  return rows.map((row) => ({ ...row, likes: count(row.discussion_likes), comments: count(row.comments), likedByMe: liked.has(row.id) }));
}
