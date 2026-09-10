"use client";

import { FormEvent, useState } from "react";
import SiteHeader from "../components/SiteHeader";

type BookResult = {
  id?: string;
  external_id?: string;
  title: string;
  author?: string | null;
  cover?: string | null;
  cover_url?: string | null;
  publishedDate?: string | null;
};

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [books, setBooks] = useState<BookResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function searchBooks(event: FormEvent) {
    event.preventDefault();
    const clean = query.trim();
    if (!clean) return;

    setLoading(true);
    setSearched(true);

    try {
      const response = await fetch(
        `/api/books/search?q=${encodeURIComponent(clean)}`,
        { cache: "no-store" }
      );
      const data = await response.json();
      setBooks(Array.isArray(data.books) ? data.books : []);
    } catch {
      setBooks([]);
    } finally {
      setLoading(false);
    }
  }

  function bookHref(book: BookResult) {
    const params = new URLSearchParams();
    params.set(
      "id",
      book.external_id ||
        book.id ||
        `${book.title}-${book.author || ""}`
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
    );
    params.set("title", book.title);
    if (book.author) params.set("author", book.author);
    const cover = book.cover || book.cover_url;
    if (cover) params.set("cover", cover);
    params.set("from", "search");
    return `/book?${params.toString()}`;
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[var(--aepilog-cream)] text-[var(--aepilog-ink)]">
      <SiteHeader active="search" />

      <div className="mx-auto max-w-5xl px-4 py-5 sm:px-5 sm:py-10 md:py-14">
        <div className="mx-auto max-w-3xl">
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--aepilog-cherry-soft)]">
            Explore aepilog
          </div>
          <h1 className="aepilog-heading mt-2 text-4xl font-medium sm:text-5xl">
            Search for a book
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--aepilog-muted)] sm:text-base">
            Find a book to see ratings, reviews, and what readers are discussing.
          </p>

          <form onSubmit={searchBooks} className="mt-7 flex gap-2">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by title or author..."
              className="min-w-0 flex-1 rounded-2xl border border-[var(--aepilog-border)] bg-[var(--aepilog-paper)] px-5 py-3.5 outline-none transition focus:border-[var(--aepilog-cherry-soft)]"
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="rounded-2xl bg-[var(--aepilog-cherry)] px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-[var(--aepilog-cherry-hover)] disabled:opacity-50"
            >
              {loading ? "Searching..." : "Search"}
            </button>
          </form>

          <div className="mt-7 space-y-3">
            {books.map((book, index) => {
              const cover = book.cover || book.cover_url;
              return (
                <a
                  key={`${book.external_id || book.id || book.title}-${index}`}
                  href={bookHref(book)}
                  className="flex gap-4 rounded-[22px] border border-[var(--aepilog-border)] bg-[var(--aepilog-paper)] p-4 transition hover:border-[var(--aepilog-cherry-soft)]"
                >
                  {cover ? (
                    <img
                      src={cover}
                      alt=""
                      className="h-28 w-[74px] shrink-0 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="flex h-28 w-[74px] shrink-0 items-center justify-center rounded-xl bg-[var(--aepilog-blush-light)] px-2 text-center text-xs text-[var(--aepilog-muted)]">
                      No cover
                    </div>
                  )}

                  <div className="min-w-0 py-1">
                    <h2 className="aepilog-heading text-xl font-medium">
                      {book.title}
                    </h2>
                    <p className="mt-1 text-sm text-[var(--aepilog-muted)]">
                      {book.author ? `by ${book.author}` : "Unknown author"}
                    </p>
                    {book.publishedDate && (
                      <p className="mt-3 text-xs text-[var(--aepilog-muted)]">
                        {book.publishedDate}
                      </p>
                    )}
                    <p className="mt-3 text-sm font-semibold text-[var(--aepilog-cherry)]">
                      View book →
                    </p>
                  </div>
                </a>
              );
            })}

            {!loading && searched && books.length === 0 && (
              <div className="rounded-[22px] border border-[var(--aepilog-border)] bg-[var(--aepilog-paper)] p-6 text-sm text-[var(--aepilog-muted)]">
                No books found. Try a longer title or the author&apos;s name.
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
