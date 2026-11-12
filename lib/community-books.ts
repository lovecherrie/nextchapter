import { supabase } from "@/lib/supabase";

export type BookChoice = { external_id: string; title: string; author: string; cover_url: string | null };
export type AttachedBook = { id: string; external_id: string | null; title: string; author: string | null; cover_url: string | null };
export const ATTACHED_BOOK_FIELDS = "id,external_id,title,author,cover_url";

export function attachedBookHref(book: AttachedBook) {
  return `/book?${new URLSearchParams({ book: book.external_id || book.id, title: book.title, author: book.author || "", ...(book.cover_url ? { cover: book.cover_url } : {}) })}`;
}

export async function ensureCommunityBook(book: BookChoice, signal?: AbortSignal): Promise<AttachedBook> {
  if (!book.external_id || !book.title.trim()) throw new Error("Choose a book first.");
  let lookup = supabase.from("books").select(ATTACHED_BOOK_FIELDS).eq("external_id", book.external_id);
  if (signal) lookup = lookup.abortSignal(signal);
  const existing = await lookup.maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data;
  let insert = supabase.from("books").insert(book).select(ATTACHED_BOOK_FIELDS);
  if (signal) insert = insert.abortSignal(signal);
  const result = await insert.single();
  if (!result.error && result.data) return result.data;
  if (result.error?.code === "23505") {
    let retry = supabase.from("books").select(ATTACHED_BOOK_FIELDS).eq("external_id", book.external_id);
    if (signal) retry = retry.abortSignal(signal);
    const duplicate = await retry.single();
    if (duplicate.error) throw duplicate.error;
    return duplicate.data;
  }
  throw result.error || new Error("Could not save this book.");
}
