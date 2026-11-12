"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import SiteHeader from "../components/SiteHeader";
import BackLink from "../components/BackLink";
import CommunityBookPicker from "../components/CommunityBookPicker";
import { useReaderViewer } from "../components/ReaderSocial";
import { ensureCommunityBook, type BookChoice } from "@/lib/community-books";
import { buddyList, buddyHref, type BuddyRead } from "@/lib/buddy-reads";
import { supabase } from "@/lib/supabase";

export default function BuddyReadsPage() {
  const viewer = useReaderViewer();
  return <main className="min-h-screen bg-[var(--aepilog-cream)] text-[var(--aepilog-ink)]"><SiteHeader active="community" />
    <section className="mx-auto max-w-3xl px-4 py-7 sm:px-5 sm:py-10"><BackLink className="text-sm underline underline-offset-4" /><h1 className="aepilog-heading mt-5 text-3xl">Reading circles</h1><p className="mt-2 text-sm text-[var(--aepilog-muted)]">Read a book together in a private group.</p>
      {viewer === undefined ? <p role="status" className="mt-6">Loading reading circles...</p> : viewer ? <BuddyList key={viewer} userId={viewer} /> : <p className="mt-6"><Link href="/auth" onClick={() => sessionStorage.setItem("nextchapter_return_after_auth", window.location.href)} className="underline">Sign in</Link> to start or join a reading circle.</p>}
    </section>
  </main>;
}

function BuddyList({ userId }: { userId: string }) {
  const router = useRouter();
  const [groups, setGroups] = useState<BuddyRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [book, setBook] = useState<BookChoice | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const requestId = useRef<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const initial = window.setTimeout(() => {
    setLoading(true); setError("");
    void buddyList(userId, AbortSignal.any([controller.signal, AbortSignal.timeout(10000)])).then(setGroups).catch(() => { if (!controller.signal.aborted) setError("Could not load your reading circles. Please try again."); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 0);
    return () => { controller.abort(); window.clearTimeout(initial); };
  }, [userId, retry]);
  async function create() {
    if (saving) return;
    if (!book) { setSaveError("Choose a book to read together."); return; }
    setSaving(true); setSaveError("");
    requestId.current ||= crypto.randomUUID();
    try {
      const savedBook = await ensureCommunityBook(book, AbortSignal.timeout(10000));
      const { data, error } = await supabase.rpc("create_buddy_read", { p_book: savedBook.id, p_title: title.trim() || `${book.title} together`.slice(0, 120), p_id: requestId.current }).abortSignal(AbortSignal.timeout(15000));
      if (error || typeof data !== "string") throw error || new Error("Missing group");
      router.push(buddyHref(data));
    } catch { setSaveError("Could not start this reading circle. Your choices are still here. Please try again."); }
    finally { setSaving(false); }
  }
  return <>
    <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="mt-6 rounded-full bg-[var(--aepilog-cherry)] px-5 py-2.5 text-sm" style={{ color: "var(--aepilog-paper)" }}>{open ? "Close editor" : "Start a reading circle"}</button>
    {open && <section aria-label="Start a reading circle" className="mt-5 space-y-5 rounded-3xl border border-[var(--aepilog-border)] bg-[var(--aepilog-paper)] p-5 sm:p-6">
      <CommunityBookPicker label="Book to read together" value={book} onChange={setBook} disabled={saving} />
      <label className="block text-sm">Group name (optional)<input value={title} onChange={(event) => setTitle(event.target.value.slice(0,120))} disabled={saving} className="mt-2 w-full rounded-xl border border-[var(--aepilog-border)] bg-white px-3 py-3" placeholder="e.g. Our next thriller" /></label>
      <p className="text-xs leading-5 text-[var(--aepilog-muted)]">Only members can see the group and its messages. Share the invite with the people you want to join. Groups can have up to 50 readers.</p>
      {saveError && <p role="alert" className="text-sm text-[var(--aepilog-cherry)]">{saveError}</p>}
      <button type="button" onClick={() => void create()} disabled={saving} className="rounded-full bg-[var(--aepilog-cherry)] px-5 py-2.5 text-sm disabled:opacity-50" style={{ color: "var(--aepilog-paper)" }}>{saving ? "Starting..." : "Create reading circle"}</button>
    </section>}
    <h2 className="aepilog-heading mt-8 text-2xl">Your reading circles</h2>
    {error && <p role="alert" className="mt-4 text-sm text-[var(--aepilog-cherry)]">{error} <button type="button" onClick={() => setRetry((value) => value+1)} className="underline">Try again</button></p>}
    {loading ? <p role="status" className="mt-4 text-sm">Loading reading circles...</p> : !error && !groups.length ? <p className="mt-4 text-sm text-[var(--aepilog-muted)]">Start one above, or ask a friend for their invite link.</p> : null}
    <div className="mt-5 space-y-3">{groups.map((group) => <Link key={group.id} href={buddyHref(group.id)} className="flex min-w-0 gap-4 rounded-2xl border border-[var(--aepilog-border)] bg-[var(--aepilog-paper)] p-4">{group.books?.cover_url && <img src={group.books.cover_url} alt="" className="h-20 w-14 shrink-0 rounded-md object-cover" />}<div className="min-w-0"><h3 className="aepilog-heading break-words text-xl">{group.title}</h3><p className="mt-1 break-words text-sm text-[var(--aepilog-muted)]">{group.books?.title}</p><span className="mt-2 block text-xs text-[var(--aepilog-cherry)]">Private reading circle →</span></div></Link>)}</div>
  </>;
}
