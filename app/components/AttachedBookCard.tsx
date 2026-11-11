"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { attachedBookHref, type AttachedBook } from "@/lib/community-books";

export function CommunityBookCover({ book, large = false }: { book: AttachedBook; large?: boolean }) {
  const [failed, setFailed] = useState<string | null>(null);
  return <div className={`${large ? "aspect-[2/3] w-24 max-w-full sm:w-32" : "h-16 w-11"} flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#f1e7e2]`}>
    {book.cover_url && failed !== book.cover_url ? <img src={book.cover_url} alt="" loading="lazy" decoding="async" onError={() => setFailed(book.cover_url)} className="h-full w-full object-cover" /> : <span aria-hidden="true" className="aepilog-heading px-2 text-center text-lg text-[#a05a62]">{Array.from(book.title)[0]}</span>}
  </div>;
}

export default function AttachedBookCard({ book }: { book: AttachedBook }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false), [saved, setSaved] = useState(false), [error, setError] = useState("");
  async function save() {
    if (saving || saved) return;
    setSaving(true); setError("");
    try {
      const { data, error: authError } = await supabase.auth.getUser();
      if (!data.user || data.user.is_anonymous) {
        sessionStorage.setItem("nextchapter_return_after_auth", window.location.href); router.push("/auth"); return;
      }
      if (authError) throw authError;
      const result = await supabase.from("want_to_read").insert({ user_id: data.user.id, book_id: book.id });
      if (result.error && result.error.code !== "23505") throw result.error;
      setSaved(true);
    } catch { setError("Could not save this book. Please try again."); }
    finally { setSaving(false); }
  }
  return <div className="mt-3 rounded-xl border border-[#e6d8d4] bg-[#fffdf9] p-3">
    <a href={attachedBookHref(book)} className="flex min-w-0 items-center gap-3"><CommunityBookCover book={book} /><span className="min-w-0"><span className="aepilog-heading block break-words text-base text-[#3a2b2b]">{book.title}</span><span className="mt-1 block text-xs text-[#756866]">{book.author}</span></span></a>
    <button type="button" onClick={() => void save()} disabled={saving || saved} aria-label={`Save ${book.title} to Want to Read`} className="mt-3 rounded-full border border-[#e6d8d4] px-3 py-2 text-xs font-semibold text-[#8f2635] disabled:opacity-60">{saved ? "Saved to Want to Read" : saving ? "Saving…" : "Want to Read"}</button>
    {error && <p role="alert" className="mt-2 text-xs text-[#8f2635]">{error}</p>}
  </div>;
}
