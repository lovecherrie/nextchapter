"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BackLink from "../components/BackLink";
import { useReaderViewer } from "../components/ReaderSocial";
import { supabase } from "@/lib/supabase";

type Report = { id: string; target_kind: string; target_id: string; reason: string; details: string; status: string; created_at: string; snapshot: { content?: string; author?: string; post_id?: string } };
type Day = { day: string; active_readers: number; returning_readers: number; signups: number; posts: number; comments: number; reviews: number; ai_requests: number };
export default function AdminPage() {
  const viewer = useReaderViewer();
  const [access, setAccess] = useState<{ user: string; allowed: boolean } | null>(null);
  const allowed = viewer ? access?.user === viewer ? access.allowed : null : viewer === null ? false : null;
  const [reports, setReports] = useState<Report[]>([]); const [days, setDays] = useState<Day[]>([]);
  const [status, setStatus] = useState("open"); const [loading, setLoading] = useState(true);
  const [error, setError] = useState(""); const [busy, setBusy] = useState<string | null>(null); const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (viewer === undefined) return;
    if (!viewer) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const role = await supabase.rpc("safety_is_moderator").abortSignal(controller.signal);
        if (role.error) throw role.error;
        if (controller.signal.aborted) return;
        setAccess({ user: viewer, allowed: role.data === true });
        if (role.data !== true) return;
        const [inbox, usage] = await Promise.all([
          supabase.from("content_reports").select("id,target_kind,target_id,reason,details,status,created_at,snapshot").eq("status", status).order("created_at", { ascending: false }).limit(50).abortSignal(controller.signal),
          supabase.rpc("safety_usage_summary").abortSignal(controller.signal),
        ]);
        if (inbox.error || usage.error) throw inbox.error || usage.error;
        if (!controller.signal.aborted) { setReports(inbox.data || []); setDays(usage.data || []); }
      } catch { if (!controller.signal.aborted) setError("Could not load the dashboard. Please try again."); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [viewer, status, revision]);
  async function review(report: Report, action: string) {
    if (busy) return;
    setBusy(report.id); setError("");
    try { const result = await supabase.rpc("safety_review_report", { p_report: report.id, p_action: action }).abortSignal(AbortSignal.timeout(10000)); if (result.error) throw result.error; setLoading(true); setRevision(value => value + 1); }
    catch { setError("Could not save that moderation decision. Please try again."); }
    finally { setBusy(null); }
  }
  return <main className="min-h-screen bg-[var(--aepilog-cream)] text-[var(--aepilog-ink)]"><div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
    <BackLink fallback="/settings" className="text-sm underline" /><h1 className="aepilog-heading mt-5 text-3xl">Reports and usage</h1>
    {error && <p role="alert" className="mt-4 text-sm text-[var(--aepilog-cherry)]">{error} <button type="button" onClick={() => { setError(""); setLoading(true); setRevision(v => v + 1); }} className="underline">Retry</button></p>}
    {allowed === false ? <p className="mt-5">This page is available to aepilog’s moderator.</p> : allowed && <>
      <section className="mt-6 rounded-3xl border border-[var(--aepilog-border)] bg-[var(--aepilog-paper)] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="aepilog-heading text-2xl">Reports</h2><label className="text-sm">Status <select aria-label="Report status" value={status} onChange={e => { setLoading(true); setStatus(e.target.value); }} className="ml-2 rounded-lg border border-[var(--aepilog-border)] bg-white px-3 py-2"><option value="open">Open</option><option value="reviewed">Reviewed</option><option value="hidden">Hidden</option></select></label></div>
        {!loading && !reports.length && <p className="mt-4 text-sm text-[var(--aepilog-muted)]">No {status} reports.</p>}
        <div className="mt-4 space-y-4">{!loading && reports.map(report => <article key={report.id} className="rounded-2xl border border-[var(--aepilog-border)] p-4">
          <p className="text-sm font-medium">{report.reason} · {report.target_kind} · {report.snapshot.author || "Reader"}</p><p className="mt-1 text-xs text-[var(--aepilog-muted)]">{new Date(report.created_at).toLocaleString()}</p>
          <details className="mt-3 text-sm"><summary className="cursor-pointer">Show reported content (may contain spoilers)</summary><p className="mt-2 whitespace-pre-wrap break-words leading-6">{report.snapshot.content || "No written content."}</p></details>
          {report.details && <p className="mt-3 whitespace-pre-wrap break-words text-sm">Report details: {report.details}</p>}
          <div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={!!busy} onClick={() => void review(report, "reviewed")} className="rounded-full border border-[var(--aepilog-border)] px-4 py-2 text-sm disabled:opacity-50">Mark reviewed</button>
            {report.target_kind !== "reader" && <button type="button" disabled={!!busy} onClick={() => void review(report, report.status === "hidden" ? "restore" : "hide")} className="rounded-full bg-[var(--aepilog-cherry)] px-4 py-2 text-sm disabled:opacity-50" style={{ color: "var(--aepilog-paper)" }}>{report.status === "hidden" ? "Restore content" : "Hide content"}</button>}
            {report.snapshot.post_id && <Link prefetch={false} href={`/discussion/${encodeURIComponent(report.snapshot.post_id)}`} className="px-3 py-2 text-sm underline">Open discussion</Link>}
          </div>
        </article>)}</div>
      </section>
      <section className="mt-6 rounded-3xl border border-[var(--aepilog-border)] bg-[var(--aepilog-paper)] p-5"><h2 className="aepilog-heading text-2xl">Daily usage</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--aepilog-muted)]">Daily totals use UTC. Active readers are signed-in readers who visited that day; your moderator visits are excluded. Returning means they visited on an earlier recorded day. Tracking starts when this feature goes live. No tracking cookies or individual browsing histories are collected.</p>
        <div className="mt-4 overflow-x-auto"><table className="w-full whitespace-nowrap text-left text-xs"><thead><tr>{["Day", "Active readers", "Returning", "New accounts", "Posts", "Comments", "Reviews", "AI requests"].map(title => <th key={title} className="border-b border-[var(--aepilog-border)] px-3 py-3 font-medium">{title}</th>)}</tr></thead><tbody>{days.map(day => <tr key={day.day}>{[day.day, day.active_readers, day.returning_readers, day.signups, day.posts, day.comments, day.reviews, day.ai_requests].map((value, index) => <td key={index} className="border-b border-[var(--aepilog-border)] px-3 py-3">{value}</td>)}</tr>)}</tbody></table></div>
      </section>
    </>}
    {(allowed === null || (allowed && loading)) && <p role="status" className="mt-5 text-sm text-[var(--aepilog-muted)]">Loading…</p>}
  </div></main>;
}
