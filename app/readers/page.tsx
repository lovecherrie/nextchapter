"use client";

import { useEffect, useState } from "react";
import SiteHeader from "../components/SiteHeader";
import SearchTabs from "../components/SearchTabs";
import { ReaderTile, useReaderViewer } from "../components/ReaderSocial";
import { followedReaders, getReader, READER_PAGE_SIZE, searchReaders, type Reader } from "@/lib/readers";

export default function ReadersPage() {
  const viewerId = useReaderViewer();
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [readers, setReaders] = useState<Reader[]>([]);
  const [following, setFollowing] = useState(new Set<string>());
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (viewerId === undefined) return;
    let current = true;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true); setError("");
      try {
        const rows = await searchReaders(query, offset, controller.signal);
        const followed = await followedReaders(viewerId, rows.map((reader) => reader.user_id), controller.signal);
        if (!current) return;
        setReaders((previous) => offset === 0 ? rows : [...previous, ...rows.filter((reader) => !previous.some((item) => item.user_id === reader.user_id))]);
        setFollowing((previous) => offset === 0 ? followed : new Set([...previous, ...followed]));
        setHasMore(rows.length === READER_PAGE_SIZE);
      } catch {
        if (current) setError("We couldn't load readers right now. Please try again.");
      } finally { if (current) setLoading(false); }
    }, query ? 300 : 0);
    return () => { current = false; clearTimeout(timer); controller.abort(); };
  }, [query, offset, viewerId, retry]);

  function changed(reader: Reader, next: boolean) {
    setFollowing((previous) => { const ids = new Set(previous); if (next) ids.add(reader.user_id); else ids.delete(reader.user_id); return ids; });
    void getReader(reader.user_id).then((updated) => {
      if (updated) setReaders((previous) => previous.map((item) => item.user_id === updated.user_id ? updated : item));
    }).catch(() => { /* Relationship is saved; counts refresh on the next read. */ });
  }

  return <main className="min-h-screen overflow-x-hidden bg-[var(--aepilog-cream)] text-[var(--aepilog-ink)]">
    <SiteHeader active="search" />
    <div className="mx-auto max-w-5xl px-4 py-7 sm:px-5 sm:py-12">
      <h1 className="aepilog-heading mt-5 text-4xl font-medium sm:text-5xl">Find your people</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--aepilog-muted)]">Discover readers, explore what they share, and follow the people whose reading lives interest you.</p>
      <SearchTabs active="people" />
      <label htmlFor="reader-search" className="mt-7 block text-sm font-semibold">Search readers</label>
      <input id="reader-search" type="search" placeholder="Search by display name..." value={query}
        onChange={(event) => { setQuery(event.target.value); setOffset(0); setReaders([]); setLoading(true); }}
        className="mt-2 w-full rounded-2xl border border-[var(--aepilog-border)] bg-[var(--aepilog-paper)] px-4 py-3.5 outline-none focus:border-[var(--aepilog-cherry)]" />
      <div aria-busy={loading} className="mt-6 grid gap-3 sm:grid-cols-2">
        {readers.map((reader) => <ReaderTile key={reader.user_id} reader={reader} viewerId={viewerId} following={following.has(reader.user_id)} onFollowChange={(next) => changed(reader, next)} />)}
      </div>
      {loading && <p role="status" className="mt-5 text-sm text-[var(--aepilog-muted)]">Finding readers...</p>}
      {error && <div role="alert" className="mt-5 text-sm text-[var(--aepilog-cherry)]">{error} <button type="button" onClick={() => setRetry((value) => value + 1)} className="ml-2 font-semibold underline">Try again</button></div>}
      {!loading && !error && readers.length === 0 && <p className="mt-5 text-sm text-[var(--aepilog-muted)]">{query.trim() ? "No readers found. Try another name." : "Readers will appear here as they join aepilog."}</p>}
      {!loading && !error && hasMore && <button type="button" onClick={() => setOffset((value) => value + READER_PAGE_SIZE)} className="mt-6 rounded-full border border-[var(--aepilog-cherry)] px-5 py-2.5 text-sm font-semibold text-[var(--aepilog-cherry)]">More readers</button>}
    </div>
  </main>;
}
