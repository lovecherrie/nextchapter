import { supabase } from "@/lib/supabase";

export type BookChoice = { external_id: string; title: string; author: string; cover_url: string | null };
export type AttachedBook = { id: string; external_id: string | null; title: string; author: string | null; cover_url: string | null };
export const ATTACHED_BOOK_FIELDS = "id,external_id,title,author,cover_url";

export function attachedBookHref(book: AttachedBook) {
  return `/book?${new URLSearchParams({ book: book.external_id || book.id, title: book.title, author: book.author || "", ...(book.cover_url ? { cover: book.cover_url } : {}) })}`;
}

export async function ensureCommunityBook(book: BookChoice): Promise<AttachedBook> {
  if (!book.external_id || !book.title.trim()) throw new Error("Choose a book first.");
  const existing = await supabase.from("books").select(ATTACHED_BOOK_FIELDS).eq("external_id", book.external_id).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data;
  const result = await supabase.from("books").insert(book).select(ATTACHED_BOOK_FIELDS).single();
  if (!result.error && result.data) return result.data;
  if (result.error?.code === "23505") {
    const duplicate = await supabase.from("books").select(ATTACHED_BOOK_FIELDS).eq("external_id", book.external_id).single();
    if (duplicate.error) throw duplicate.error;
    return duplicate.data;
  }
  throw result.error || new Error("Could not save this book.");
}
