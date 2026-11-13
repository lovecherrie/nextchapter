import type { AttachedBook } from "@/lib/community-books";

export type BookPoll = {
  post_id: string;
  left_book_id: string;
  right_book_id: string;
  left_votes: number;
  right_votes: number;
  left_book: AttachedBook | null;
  right_book: AttachedBook | null;
};
export const POLL_FIELDS = "post_id,left_book_id,right_book_id,left_votes,right_votes,left_book:books!book_polls_left_book_id_fkey(id,external_id,title,author,cover_url,book_genres(genres)),right_book:books!book_polls_right_book_id_fkey(id,external_id,title,author,cover_url,book_genres(genres))";
export function pollFromPost(value: BookPoll | BookPoll[] | null | undefined): BookPoll | null {
  return Array.isArray(value) ? value[0] || null : value || null;
}
export function pollTotal(poll: BookPoll | null) {
  return poll ? Number(poll.left_votes) + Number(poll.right_votes) : 0;
}
export function discussionEngagement(post: { discussion_likes: unknown[]; comments: unknown[]; book_polls?: BookPoll | BookPoll[] | null }) {
  return post.discussion_likes.length + post.comments.length * 2 + pollTotal(pollFromPost(post.book_polls));
}
export function pollPercentages(left: number, right: number) {
  const total = left + right;
  if (!total) return { left: 0, right: 0 };
  const percent = Math.round(left / total * 100);
  return { left: percent, right: 100 - percent };
}
