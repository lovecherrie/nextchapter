"use client";
import { useEffect, useId, useState } from "react";
import type { BookChoice } from "@/lib/community-books";

export default function CommunityBookPicker({ label, value, onChange, disabled = false }: { label: string; value: BookChoice | null; onChange: (book: BookChoice | null) => void; disabled?: boolean }) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BookChoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (value || query.trim().length < 2) return;
    const controller = new AbortController(); let current = true;
    const timer = setTimeout(async () => {
      setLoading(true); setError("");
      try {
        const response = await fetch(`/api/books/search?${new URLSearchParams({ q: query.trim() })}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Search unavailable");
        const data = await response.json();
        const rows = [...(data.suggestions || []), ...(data.books || [])];
        const seen = new Set<string>();
        const books = rows.flatMap((row): BookChoice[] => {
          const external = row.external_id || row.id;
          if (!external || !row.title || seen.has(external)) return [];
          seen.add(external);
          return [{ external_id: String(external), title: String(row.title), author: String(row.author || "Unknown author"), cover_url: row.cover_url || row.cover || null }];
        });
        if (current) setResults(books.slice(0, 6));
      } catch { if (current && !controller.signal.aborted) setError("Book search is unavailable. Please try again."); }
      finally { if (current) setLoading(false); }
    }, 350);
    return () => { current = false; clearTimeout(timer); controller.abort(); };
  }, [query, value]);
  return <div>
    <label htmlFor={id} className="text-xs font-semibold text-[#756866]">{label}</label>
    {value ? <div className="aepilog-reveal mt-2 flex items-center gap-3 rounded-xl border border-[#e6d8d4] bg-[#faf6ef] p-3">
      <div className="min-w-0 flex-1"><p className="break-words text-sm font-semibold">{value.title}</p><p className="mt-1 text-xs text-[#756866]">{value.author}</p></div>
      <button type="button" disabled={disabled} onClick={() => { onChange(null); setQuery(""); setResults([]); }} aria-label={`Remove ${value.title}`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xl text-[#8f2635]">×</button>
    </div> : <>
      <input id={id} type="search" disabled={disabled} value={query} onChange={(event) => { setQuery(event.target.value); setLoading(event.target.value.trim().length >= 2); setResults([]); setError(""); }} placeholder="Search by title or author" className="mt-2 w-full rounded-xl border border-[#e6d8d4] bg-white px-3 py-3 text-sm outline-none focus:border-[#8f2635]" />
      {query.trim().length >= 2 && <div className="aepilog-reveal mt-2 max-h-60 overflow-y-auto rounded-xl border border-[#e6d8d4] bg-white">
        {loading && <p role="status" className="p-3 text-xs text-[#756866]">Searching…</p>}
        {error && <p role="alert" className="p-3 text-xs text-[#8f2635]">{error}</p>}
        {results.map((book) => <button key={book.external_id} type="button" disabled={disabled} onClick={() => { onChange(book); setResults([]); }} className="block w-full border-b border-[#eee2de] p-3 text-left text-sm last:border-0 hover:bg-[#faf6ef]"><span className="block font-semibold">{book.title}</span><span className="mt-1 block text-xs text-[#756866]">{book.author}</span></button>)}
        {!loading && !error && results.length === 0 && <p className="p-3 text-xs text-[#756866]">No matches yet. Try the title or author.</p>}
      </div>}
    </>}
  </div>;
}
