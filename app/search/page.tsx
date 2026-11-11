"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import SiteHeader from "../components/SiteHeader";
import SearchTabs from "../components/SearchTabs";

type BookResult = {
  id?: string;
  external_id?: string;
  title: string;
  author?: string | null;
  cover?: string | null;
  cover_url?: string | null;
  publishedDate?: string | null;
  isbn10?: string | null;
  isbn13?: string | null;
};

function SearchCover({ book }: { book: BookResult }) {
  const [failed, setFailed] = useState(0);
  const isbn = book.isbn13 || book.isbn10;
  const sources = [...new Set([
    book.cover || book.cover_url,
    isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false` : null,
  ].filter((value): value is string => Boolean(value)))];
  const source = sources[failed];
  return source ? (
    <img
      src={source}
      alt=""
      loading="lazy"
      onError={() => setFailed((count) => count + 1)}
      className="h-28 w-[74px] shrink-0 rounded-xl object-cover"
    />
  ) : (
    <div className="flex h-28 w-[74px] shrink-0 items-center justify-center rounded-xl bg-[var(--aepilog-blush-light)] px-2 text-center text-xs text-[var(--aepilog-muted)]">
      No cover
    </div>
  );
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [books, setBooks] = useState<BookResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState<BookResult[]>([]);
  const [composing, setComposing] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestId = useRef(0);

  const runSearch = useCallback(async (clean: string) => {
    controller.current?.abort();
    const currentController = new AbortController();
    controller.current = currentController;
    const currentRequest = ++requestId.current;

    setLoading(true);
    setSearched(true);
    setError("");

    try {
      const response = await fetch(
        `/api/books/search?q=${encodeURIComponent(clean)}`,
        { cache: "no-store", signal: currentController.signal }
      );
      if (!response.ok) throw new Error("Book search failed");
      const data = await response.json();
      if (data.error) throw new Error("Book search failed");
      if (currentRequest !== requestId.current) return;
      setBooks(Array.isArray(data.books) ? data.books : []);
      setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
    } catch {
      if (currentController.signal.aborted || currentRequest !== requestId.current) return;
      setBooks([]);
      setSuggestions([]);
      setError("Book search is unavailable right now. Please try again.");
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const clean = query.trim();
    if (clean.length < 2 || composing) return;
    timer.current = setTimeout(() => void runSearch(clean), 350);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      controller.current?.abort();
    };
  }, [query, composing, runSearch]);

  function changeQuery(value: string) {
    ++requestId.current;
    controller.current?.abort();
    if (timer.current) clearTimeout(timer.current);
    setQuery(value);
    setBooks([]);
    setSuggestions([]);
    setError("");
    setSearched(false);
    setLoading(value.trim().length >= 2);
  }

  function searchBooks(event: FormEvent) {
    event.preventDefault();
    if (query.trim().length < 2 || composing) return;
    if (timer.current) clearTimeout(timer.current);
    void runSearch(query.trim());
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
            Search aepilog
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--aepilog-muted)] sm:text-base">
            Find a book to see ratings, reviews, and what readers are discussing.
          </p>

          <SearchTabs active="books" />

          <form onSubmit={searchBooks} className="mt-7 flex gap-2">
            <input
              value={query}
              onChange={(event) => changeQuery(event.target.value)}
              onCompositionStart={() => setComposing(true)}
              onCompositionEnd={() => setComposing(false)}
              aria-label="Search by title or author"
              aria-controls="book-search-results"
              placeholder="Search by title or author..."
              className="min-w-0 flex-1 rounded-2xl border border-[var(--aepilog-border)] bg-[var(--aepilog-paper)] px-5 py-3.5 outline-none transition focus:border-[var(--aepilog-cherry-soft)]"
            />
            <button
              type="submit"
              disabled={query.trim().length < 2}
              className="rounded-2xl bg-[var(--aepilog-cherry)] px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-[var(--aepilog-cherry-hover)] disabled:opacity-50"
            >
              {loading ? "Searching..." : "Search"}
            </button>
          </form>

          <div id="book-search-results" aria-busy={loading} className="mt-7 space-y-3">
            {loading && <p role="status" className="text-sm text-[var(--aepilog-muted)]">Searching for books...</p>}
            {error && (
              <p role="alert" className="text-sm text-[var(--aepilog-cherry)]">
                {error}
              </p>
            )}
            {[...suggestions, ...books.filter((book) => !suggestions.some((suggestion) =>
              (suggestion.external_id || suggestion.id) === (book.external_id || book.id)
            ))].map((book, index) => {
              const cover = book.cover || book.cover_url;
              return (
                <div key={`${book.external_id || book.id || book.title}-${index}`}>
                  {suggestions.length > 0 && index === 0 && (
                    <p className="mb-3 text-sm text-[var(--aepilog-muted)]">Close title matches — is one of these what you meant?</p>
                  )}
                  {suggestions.length > 0 && index === suggestions.length && (
                    <p className="mb-3 text-sm text-[var(--aepilog-muted)]">Other results</p>
                  )}
                <a
                  href={bookHref(book)}
                  className="flex gap-4 rounded-[22px] border border-[var(--aepilog-border)] bg-[var(--aepilog-paper)] p-4 transition hover:border-[var(--aepilog-cherry-soft)]"
                >
                  <SearchCover key={`${cover}-${book.isbn13}-${book.isbn10}`} book={book} />

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
                </div>
              );
            })}

            {!loading && !error && searched && books.length === 0 && suggestions.length === 0 && (
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
