"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import SiteHeader from "../components/SiteHeader";
import BackLink from "../components/BackLink";
import { useNotifications } from "../components/Notifications";
import { supabase } from "@/lib/supabase";
import { discussionHref } from "@/lib/discussion-links";

type Notification = { id: string; actor_name: string; post_id: string; comment_id: string; kind: "comment" | "reply"; created_at: string; read_at: string | null };

export default function NotificationsPage() {
  const { viewer, refresh } = useNotifications();
  const [result, setResult] = useState<{ user: string; rows: Notification[]; more: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const rows = result && result.user === viewer ? result.rows : [];
  const load = useCallback(async (user: string, offset = 0, signal?: AbortSignal) => {
    setLoading(true); setError("");
    try {
      const { data, error } = await supabase.from("reply_notifications").select("id,actor_name,post_id,comment_id,kind,created_at,read_at").eq("recipient_id", user).order("created_at", { ascending: false }).order("id", { ascending: false }).range(offset, offset + 29).abortSignal(signal ? AbortSignal.any([signal, AbortSignal.timeout(10000)]) : AbortSignal.timeout(10000));
      if (signal?.aborted) return;
      if (error) throw error;
      setResult((previous) => ({ user, rows: offset && previous?.user === user ? [...previous.rows, ...(data || []).filter((row) => !previous.rows.some((old) => old.id === row.id))] : data || [], more: (data?.length || 0) === 30 }));
    } catch { if (!signal?.aborted) setError("Could not load notifications. Please try again."); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, []);
  useEffect(() => { if (!viewer) return; const controller = new AbortController(); const initial = window.setTimeout(() => void load(viewer, 0, controller.signal), 0); return () => { controller.abort(); window.clearTimeout(initial); }; }, [viewer, load]);
  async function markRead(id?: string) {
    if (!viewer || saving) return;
    setSaving(true); setError("");
    const readAt = new Date().toISOString();
    try {
      let query = supabase.from("reply_notifications").update({ read_at: readAt }).eq("recipient_id", viewer).is("read_at", null);
      if (id) query = query.eq("id", id);
      const { error } = await query.abortSignal(AbortSignal.timeout(10000));
      if (error) throw error;
      setResult((previous) => previous?.user === viewer ? { ...previous, rows: previous.rows.map((row) => !id || row.id === id ? { ...row, read_at: row.read_at || readAt } : row) } : previous);
      refresh();
    } catch { setError("Could not mark notifications as read. Please try again."); }
    finally { setSaving(false); }
  }
  return <main className="min-h-screen bg-[var(--aepilog-cream)] text-[var(--aepilog-ink)]"><SiteHeader />
    <section className="mx-auto max-w-3xl px-4 py-7 sm:px-5 sm:py-10">
      <BackLink className="text-sm underline underline-offset-4" />
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><h1 className="aepilog-heading text-3xl">Notifications</h1>{viewer && <button type="button" disabled={saving || loading} onClick={() => void markRead()} className="rounded-full border border-[var(--aepilog-border)] px-4 py-2 text-sm disabled:opacity-50">Mark all as read</button>}</div>
      {viewer === undefined ? <p role="status" className="mt-6">Loading notifications...</p> : !viewer ? <p className="mt-6"><Link href="/auth" onClick={() => sessionStorage.setItem("nextchapter_return_after_auth", window.location.href)} className="underline">Sign in</Link> to see your replies.</p> : <>
        {error && <p role="alert" className="mt-5 text-sm text-[var(--aepilog-cherry)]">{error} <button type="button" onClick={() => void load(viewer)} className="underline">Refresh</button></p>}
        {loading && !rows.length ? <p role="status" className="mt-6">Loading notifications...</p> : !error && !rows.length ? <p className="mt-6 text-[var(--aepilog-muted)]">No replies yet. New comments on your posts and replies to your comments will appear here.</p> : null}
        <div className="mt-6 space-y-3">{rows.map((row) => <article key={row.id} className={`rounded-2xl border border-[var(--aepilog-border)] p-4 ${row.read_at ? "bg-[var(--aepilog-paper)]" : "bg-[var(--aepilog-blush-light)]"}`}>
          <Link href={`${discussionHref(row.post_id)}#comment-${row.comment_id}`} onClick={() => { if (!row.read_at) void markRead(row.id); }} className="block break-words"><span className="font-medium">{row.actor_name}</span> {row.kind === "reply" ? "replied to your comment." : "commented on your post."}<span className="mt-2 block text-xs text-[var(--aepilog-muted)]">{new Date(row.created_at).toLocaleString()}</span></Link>
          {!row.read_at && <button type="button" disabled={saving} onClick={() => void markRead(row.id)} className="mt-3 text-xs text-[var(--aepilog-cherry)] underline disabled:opacity-50">Mark as read</button>}
        </article>)}</div>
        {result && result.user === viewer && result.more && <button type="button" disabled={loading} onClick={() => void load(viewer, rows.length)} className="mt-5 rounded-full border border-[var(--aepilog-border)] px-4 py-2 text-sm">{loading ? "Loading..." : "Load more"}</button>}
      </>}
    </section>
  </main>;
}
