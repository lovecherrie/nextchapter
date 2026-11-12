"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { discussionHref } from "@/lib/discussion-links";
import BackLink from "../../components/BackLink";
import SiteHeader from "../../components/SiteHeader";
import { FollowButton, ReaderAvatar, ReaderTile, ReaderDisplayName, useReaderViewer } from "../../components/ReaderSocial";
import { followedReaders, getReader, readerActivity, readerConnections, readerTopBooks, READER_PAGE_SIZE, type Reader, type ReaderActivity, type ReaderBook, type ReaderTopBook } from "@/lib/readers";

function bookHref(book: ReaderBook) {
  return `/book?${new URLSearchParams({ book: book.external_id || book.id, title: book.title, author: book.author || "", ...(book.cover_url ? { cover: book.cover_url } : {}) })}`;
}

function ActivityCard({ item }: { item: ReaderActivity }) {
  const [revealed, setRevealed] = useState(false);
  return <article className="rounded-[22px] border border-[var(--aepilog-border)] bg-[var(--aepilog-paper)] p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--aepilog-muted)]">
      <span>{item.kind === "rating" ? `Rating · ${Number(item.overall_rating).toFixed(1)}/5` : "Discussion"}</span>
      <time dateTime={item.created_at}>{new Date(item.created_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}</time>
    </div>
    {item.books && <a href={bookHref(item.books)} className="aepilog-heading mt-3 inline-block text-xl font-medium text-[var(--aepilog-cherry)]">{item.books.title}</a>}
    {item.books?.author && <p className="mt-1 text-xs text-[var(--aepilog-muted)]">by {item.books.author}</p>}
    {item.content && (item.contains_spoilers ? <>
      <button type="button" aria-expanded={revealed} onClick={() => setRevealed((value) => !value)} className="mt-4 rounded-full border border-[var(--aepilog-border)] px-3 py-2 text-xs font-semibold text-[var(--aepilog-cherry)]">{revealed ? "Hide spoiler" : "Show spoiler"}</button>
      {revealed && <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7">{item.content}</p>}
    </> : <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7">{item.content}</p>)}
    {item.kind === "discussion" && <Link href={discussionHref(item.id)} className="mt-4 inline-block text-sm font-medium underline underline-offset-4">View discussion →</Link>}
  </article>;
}

export default function PublicReaderPage({ userId }: { userId: string }) {
  const viewerId = useReaderViewer();
  const [reader, setReader] = useState<Reader | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [following, setFollowing] = useState(new Set<string>());
  const [panel, setPanel] = useState<"activity" | "followers" | "following">("activity");
  const [activity, setActivity] = useState<ReaderActivity[]>([]);
  const [connections, setConnections] = useState<Reader[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [panelLoading, setPanelLoading] = useState(true);
  const [panelError, setPanelError] = useState("");
  const [shelf, setShelf] = useState<{ readerId: string; books: ReaderTopBook[]; error: boolean } | null>(null);

  useEffect(() => {
    if (!reader || reader.show_top_books === false) { setShelf(null); return; }
    const controller = new AbortController(); let current = true;
    void readerTopBooks(reader, controller.signal).then((books) => {
      if (current) setShelf({ readerId: reader.user_id, books, error: false });
    }).catch(() => { if (current) setShelf({ readerId: reader.user_id, books: [], error: true }); });
    return () => { current = false; controller.abort(); };
  }, [reader, retry]);

  useEffect(() => {
    if (viewerId === undefined) return;
    const controller = new AbortController();
    let current = true;
    void (async () => {
      try {
        const profile = await getReader(userId, controller.signal);
        const followed = await followedReaders(viewerId, profile ? [profile.user_id] : [], controller.signal);
        if (current) {
          setReader(profile && (profile.is_public || profile.user_id === viewerId) ? profile : null);
          setFollowing(followed); setError("");
        }
      } catch { if (current) setError("We couldn't load this reader right now. Please try again."); }
      finally { if (current) setLoading(false); }
    })();
    return () => { current = false; controller.abort(); };
  }, [userId, viewerId, retry]);

  useEffect(() => {
    if (!reader || viewerId === undefined) return;
    const controller = new AbortController();
    let current = true;
    void (async () => {
      try {
        if (panel === "activity") {
          const rows = await readerActivity(reader, controller.signal);
          if (current) setActivity(rows);
        } else {
          const result = await readerConnections(reader.user_id, panel, offset, controller.signal);
          const followed = await followedReaders(viewerId, result.readers.map((item) => item.user_id), controller.signal);
          if (!current) return;
          setConnections((previous) => offset === 0 ? result.readers : [...previous, ...result.readers.filter((item) => !previous.some((entry) => entry.user_id === item.user_id))]);
          setFollowing((previous) => {
            const next = new Set(previous);
            for (const item of result.readers) { if (followed.has(item.user_id)) next.add(item.user_id); else next.delete(item.user_id); }
            return next;
          });
          setHasMore(result.hasMore);
        }
        if (current) setPanelError("");
      } catch { if (current) setPanelError("We couldn't load this section. Please try again."); }
      finally { if (current) setPanelLoading(false); }
    })();
    return () => { current = false; controller.abort(); };
  }, [reader, panel, offset, viewerId, retry]);

  function selectPanel(next: typeof panel) {
    if (next === panel) return;
    setPanel(next); setOffset(0); setConnections([]); setPanelLoading(true); setPanelError("");
  }
  function changed(id: string, next: boolean) {
    setFollowing((previous) => { const ids = new Set(previous); if (next) ids.add(id); else ids.delete(id); return ids; });
    void getReader(userId).then((updated) => { if (updated) setReader(updated); }).catch(() => {});
    if (id !== userId) void getReader(id).then((updated) => { if (updated) setConnections((previous) => previous.map((item) => item.user_id === id ? updated : item)); }).catch(() => {});
  }

  return <main className="min-h-screen overflow-x-hidden bg-[var(--aepilog-cream)] text-[var(--aepilog-ink)]">
    <SiteHeader active="community" />
    <div className="mx-auto max-w-4xl px-4 py-7 sm:px-5 sm:py-12">
      <BackLink fallback="/readers" className="text-sm font-semibold text-[var(--aepilog-cherry)]" />
      {loading ? <p role="status" className="mt-8 text-sm text-[var(--aepilog-muted)]">Loading reader profile...</p> : error ? <div role="alert" className="mt-8 text-sm text-[var(--aepilog-cherry)]">{error} <button type="button" onClick={() => setRetry((value) => value + 1)} className="ml-2 underline">Try again</button></div> : !reader ? <section className="mt-7 rounded-[28px] border border-[var(--aepilog-border)] bg-[var(--aepilog-paper)] p-6">
        <h1 className="aepilog-heading text-3xl">Reader not found</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--aepilog-muted)]">This profile may be private or no longer available.</p>
      </section> : <>
        <section className="mt-7 rounded-[28px] border border-[var(--aepilog-border)] bg-[var(--aepilog-paper)] p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="flex min-w-0 items-center gap-4">
              <ReaderAvatar name={reader.display_name} path={reader.avatar_path} large />
              <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-widest text-[var(--aepilog-cherry-soft)]">aepilog reader</p><h1 className="aepilog-heading mt-2 break-words text-3xl font-medium sm:text-4xl"><ReaderDisplayName name={reader.display_name} /></h1></div>
            </div>
            <FollowButton reader={reader} viewerId={viewerId} following={following.has(userId)} onChange={(next) => changed(userId, next)} />
          </div>
          {reader.bio && <p className="mt-5 whitespace-pre-wrap break-words text-sm leading-7 text-[var(--aepilog-muted)]">{reader.bio}</p>}
          {!reader.is_public && <p className="mt-4 text-sm text-[var(--aepilog-cherry)]">Only you can see this profile while it is hidden.</p>}
          <div className="mt-5 flex flex-wrap gap-5 text-sm">
            <button type="button" onClick={() => selectPanel("followers")} className="text-[var(--aepilog-muted)]"><strong className="text-[var(--aepilog-ink)]">{reader.follower_count}</strong> {Number(reader.follower_count) === 1 ? "follower" : "followers"}</button>
            <button type="button" onClick={() => selectPanel("following")} className="text-[var(--aepilog-muted)]"><strong className="text-[var(--aepilog-ink)]">{reader.following_count}</strong> following</button>
          </div>
        </section>
        {reader.show_top_books !== false && shelf?.readerId === reader.user_id && (shelf.books.length > 0 || shelf.error) && <section aria-label="Top 4 books" className="mt-6 rounded-[28px] border border-[var(--aepilog-border)] bg-[var(--aepilog-paper)] p-5 sm:p-7">
          <h2 className="aepilog-heading text-2xl">Top 4</h2>
          {shelf.error ? <p className="mt-3 text-sm text-[var(--aepilog-muted)]">Could not load this shelf. <button type="button" className="underline" onClick={() => setRetry((value) => value + 1)}>Try again</button></p> : <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {shelf.books.map((item) => item.books && <Link key={item.id} href={bookHref(item.books)} className="min-w-0">
              <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-[var(--aepilog-blush-light)]">
                {item.books.cover_url ? <img src={item.books.cover_url} alt={item.books.title} className="h-full w-full object-cover" loading="lazy" /> : <div className="flex h-full items-center justify-center p-3 text-center text-sm">{item.books.title}</div>}
                <span className="absolute left-2 top-2 rounded-full bg-[var(--aepilog-paper)] px-2 py-1 text-xs font-semibold">#{item.position}</span>
              </div>
              <p className="mt-2 truncate text-sm font-semibold">{item.books.title}</p>
              <p className="mt-1 truncate text-xs text-[var(--aepilog-muted)]">{item.books.author}</p>
            </Link>)}
          </div>}
        </section>}
        <div role="tablist" aria-label="Reader profile sections" className="mt-6 flex flex-wrap gap-2">
          {(["activity", "followers", "following"] as const).map((tab) => <button key={tab} id={`reader-tab-${tab}`} type="button" role="tab" aria-selected={panel === tab} aria-controls="reader-profile-panel" onClick={() => selectPanel(tab)} className={`rounded-full px-4 py-2.5 text-sm font-semibold capitalize ${panel === tab ? "bg-[var(--aepilog-cherry)] text-white" : "border border-[var(--aepilog-border)] bg-[var(--aepilog-paper)] text-[var(--aepilog-muted)]"}`}>{tab}</button>)}
        </div>
        <section id="reader-profile-panel" role="tabpanel" aria-labelledby={`reader-tab-${panel}`} aria-busy={panelLoading} className="mt-5 space-y-3">
          {panelLoading && <p role="status" className="text-sm text-[var(--aepilog-muted)]">Loading {panel}...</p>}
          {panelError && <div role="alert" className="text-sm text-[var(--aepilog-cherry)]">{panelError} <button type="button" onClick={() => setRetry((value) => value + 1)} className="ml-2 underline">Try again</button></div>}
          {!panelLoading && !panelError && panel === "activity" && (reader.show_activity ? activity.length ? activity.map((item) => <ActivityCard key={`${item.kind}-${item.id}`} item={item} />) : <p className="text-sm text-[var(--aepilog-muted)]">No ratings or discussions shared yet.</p> : <p className="text-sm text-[var(--aepilog-muted)]">This reader isn&apos;t displaying activity on their profile.</p>)}
          {panel !== "activity" && connections.map((item) => <ReaderTile key={item.user_id} reader={item} viewerId={viewerId} following={following.has(item.user_id)} onFollowChange={(next) => changed(item.user_id, next)} />)}
          {!panelLoading && !panelError && panel !== "activity" && connections.length === 0 && <p className="text-sm text-[var(--aepilog-muted)]">No public readers to show here yet.</p>}
          {!panelLoading && !panelError && panel !== "activity" && hasMore && <button type="button" onClick={() => { setOffset((value) => value + READER_PAGE_SIZE); setPanelLoading(true); }} className="rounded-full border border-[var(--aepilog-cherry)] px-5 py-2.5 text-sm font-semibold text-[var(--aepilog-cherry)]">More readers</button>}
        </section>
      </>}
    </div>
  </main>;
}
