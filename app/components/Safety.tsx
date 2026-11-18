"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { validReaderId } from "@/lib/readers";
import { useNotifications } from "./Notifications";

type ReportTarget = { kind: "post" | "comment" | "review" | "reader"; id: string; authorId: string };
const SafetyContext = createContext<{ viewer: string | null | undefined; report: (target: ReportTarget) => void; block: (target: string, remove?: boolean) => Promise<void> }>({ viewer: undefined, report: () => {}, block: async () => {} });

export function SafetyProvider({ children }: { children: ReactNode }) {
  const { viewer } = useNotifications();
  const router = useRouter();
  const [draftOwner, setDraftOwner] = useState(viewer);
  const dialogRef = useRef<HTMLElement>(null);
  const busyRef = useRef(false);
  const [target, setTarget] = useState<ReportTarget | null>(null);
  const [reason, setReason] = useState("spam");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => { busyRef.current = busy; }, [busy]);
  if (draftOwner !== viewer) { setDraftOwner(viewer); setTarget(null); setDetails(""); setError(""); }
  useEffect(() => {
    if (!target) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector<HTMLElement>("select")?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busyRef.current) { event.preventDefault(); setTarget(null); }
      if (event.key !== "Tab") return;
      const elements = [...(dialogRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled),select:not(:disabled),textarea:not(:disabled)") || [])];
      if (!elements.length) { event.preventDefault(); return; }
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keyboard);
    return () => { document.removeEventListener("keydown", keyboard); document.body.style.overflow = overflow; previous?.focus(); };
  }, [target]);
  useEffect(() => {
    if (!viewer) return;
    const user = viewer;
    let pending = false;
    async function mark() {
      if (document.visibilityState === "hidden" || pending) return;
      const key = `aepilog-active:${user}:${new Date().toISOString().slice(0, 10)}`;
      try { if (sessionStorage.getItem(key)) return; } catch { /* Optional presentation cache. */ }
      pending = true;
      try {
        const result = await supabase.rpc("mark_active_reader").abortSignal(AbortSignal.timeout(5000));
        if (!result.error) { try { sessionStorage.setItem(key, "1"); } catch {} }
      } catch { /* Usage measurement must never interrupt reading. */ }
      finally { pending = false; }
    }
    void mark(); document.addEventListener("visibilitychange", mark); window.addEventListener("focus", mark);
    return () => { document.removeEventListener("visibilitychange", mark); window.removeEventListener("focus", mark); };
  }, [viewer]);
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(""), 5000); return () => window.clearTimeout(timer); }, [notice]);

  function requireLogin() {
    if (viewer) return true;
    sessionStorage.setItem("nextchapter_return_after_auth", window.location.href); router.push("/auth"); return false;
  }
  function report(next: ReportTarget) { if (!requireLogin()) return; setReason("spam"); setDetails(""); setError(""); setTarget(next); }
  async function block(id: string, remove = false) {
    if (!requireLogin() || !validReaderId(id) || id === viewer) return;
    const result = remove
      ? await supabase.from("reader_blocks").delete().eq("blocker_id", viewer!).eq("blocked_id", id).abortSignal(AbortSignal.timeout(10000))
      : await supabase.from("reader_blocks").upsert({ blocker_id: viewer, blocked_id: id }, { onConflict: "blocker_id,blocked_id", ignoreDuplicates: true }).abortSignal(AbortSignal.timeout(10000));
    if (result.error) throw new Error("Could not update blocking. Please try again.");
    // Discard all account-scoped and feed presentation caches after changing visibility.
    window.location.reload();
  }
  async function submit() {
    if (!target || busy) return;
    setBusy(true); setError("");
    try {
      const result = await supabase.rpc("safety_submit_report", { p_kind: target.kind, p_target: target.id, p_reason: reason, p_details: details.trim() }).abortSignal(AbortSignal.timeout(10000));
      if (result.error) throw result.error;
      setTarget(null); setNotice("Report sent. Thank you for letting us know.");
    } catch { setError("Could not send this report. Please wait a moment and try again."); }
    finally { setBusy(false); }
  }
  return <SafetyContext.Provider value={{ viewer, report, block }}>{children}
    {notice && <div role="status" className="fixed bottom-5 left-1/2 z-[100] w-[min(90vw,400px)] -translate-x-1/2 rounded-2xl border border-[var(--aepilog-border)] bg-[var(--aepilog-paper)] p-4 text-sm shadow-lg">{notice}</div>}
    {target && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 p-4" onClick={() => { if (!busy) setTarget(null); }}>
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="report-heading" className="aepilog-panel w-full max-w-md rounded-3xl bg-[var(--aepilog-paper)] p-6 shadow-xl" onClick={event => event.stopPropagation()}>
        <div className="flex items-center justify-between gap-3"><h2 id="report-heading" className="aepilog-heading text-2xl font-medium">Report {target.kind === "post" ? "discussion" : target.kind}</h2><button type="button" disabled={busy} aria-label="Close report" onClick={() => setTarget(null)} className="rounded-full px-3 py-2">×</button></div>
        <p className="mt-2 text-sm text-[var(--aepilog-muted)]">Your report is shared privately with aepilog’s moderator.</p>
        <label className="mt-5 block text-sm">Reason<select value={reason} disabled={busy} onChange={e => setReason(e.target.value)} className="mt-2 w-full rounded-xl border border-[var(--aepilog-border)] bg-white p-3"><option value="spam">Spam</option><option value="harassment">Harassment or abuse</option><option value="spoilers">Unmarked spoilers</option><option value="other">Something else</option></select></label>
        <label className="mt-4 block text-sm">Details <span className="text-[var(--aepilog-muted)]">(optional)</span><textarea maxLength={1000} value={details} disabled={busy} onChange={e => setDetails(e.target.value)} className="mt-2 min-h-24 w-full rounded-xl border border-[var(--aepilog-border)] bg-white p-3" /></label>
        {error && <p role="alert" className="mt-3 text-sm text-[var(--aepilog-cherry)]">{error}</p>}
        <button type="button" disabled={busy} onClick={() => void submit()} className="mt-4 rounded-full bg-[var(--aepilog-cherry)] px-5 py-2.5 text-sm disabled:opacity-50" style={{ color: "var(--aepilog-paper)" }}>{busy ? "Sending…" : "Send report"}</button>
      </section>
    </div>}
  </SafetyContext.Provider>;
}

export function SafetyActions({ kind, targetId, authorId }: { kind: ReportTarget["kind"]; targetId: string; authorId: string }) {
  const { viewer, report, block } = useContext(SafetyContext);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  if (viewer === undefined || viewer === authorId || !validReaderId(targetId)) return null;
  return <details className="relative inline-block shrink-0 text-xs" data-menu-root>
    <summary aria-label={`Report or block ${kind === "post" ? "discussion" : kind}`} className="cursor-pointer list-none rounded-full px-2 py-1 text-lg text-[var(--aepilog-muted)]">⋯</summary>
    <div className={`aepilog-popover absolute z-30 min-w-40 rounded-xl border border-[var(--aepilog-border)] bg-[var(--aepilog-paper)] p-2 shadow-lg ${kind === "comment" ? "bottom-full left-0 mb-1" : "right-0"}`} style={{ transformOrigin: kind === "comment" ? "bottom left" : "top right" }}>
      <button type="button" disabled={busy} onClick={() => report({ kind, id: targetId, authorId })} className="block w-full rounded-lg px-3 py-2 text-left hover:bg-[var(--aepilog-blush-light)]">Report</button>
      {validReaderId(authorId) && <button type="button" disabled={busy || viewer === undefined} onClick={() => { setBusy(true); setError(""); void block(authorId).catch(() => setError("Could not block this reader. Please try again.")).finally(() => setBusy(false)); }} className="block w-full rounded-lg px-3 py-2 text-left hover:bg-[var(--aepilog-blush-light)]">{busy ? "Saving…" : "Block reader"}</button>}
      {error && <p role="alert" className="px-3 py-2 text-[var(--aepilog-cherry)]">{error}</p>}
    </div>
  </details>;
}

export function SafetySettings({ userId }: { userId: string }) {
  const { block } = useContext(SafetyContext);
  const [blocked, setBlocked] = useState<{ user_id: string; display_name: string }[]>([]);
  const [moderator, setModerator] = useState(false); const [loading, setLoading] = useState(true);
  const [error, setError] = useState(""); const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([supabase.rpc("safety_blocked_readers").abortSignal(controller.signal), supabase.rpc("safety_is_moderator").abortSignal(controller.signal)]).then(([rows, role]) => {
      if (controller.signal.aborted) return;
      if (rows.error || role.error) setError("Could not load safety settings. Please refresh to try again.");
      else { setBlocked(rows.data || []); setModerator(role.data === true); }
    }).catch(() => { if (!controller.signal.aborted) setError("Could not load safety settings."); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [userId]);
  return <section className="mt-6 rounded-3xl border border-[var(--aepilog-border)] bg-[var(--aepilog-paper)] p-6">
    <h2 className="aepilog-heading text-2xl">Blocked readers</h2><p className="mt-2 text-sm leading-6 text-[var(--aepilog-muted)]">Blocking hides their content while you’re signed in and stops direct replies and follows. Public posts can still be read when signed out.</p>
    {loading ? <p role="status" className="mt-4 text-sm">Loading…</p> : blocked.length ? <ul className="mt-4 space-y-3">{blocked.map(reader => <li key={reader.user_id} className="flex items-center justify-between gap-3 text-sm"><span>{reader.display_name}</span><button type="button" disabled={!!busy} onClick={() => { setBusy(reader.user_id); void block(reader.user_id, true).catch(() => setError("Could not unblock this reader. Please try again.")).finally(() => setBusy(null)); }} className="rounded-full border border-[var(--aepilog-border)] px-4 py-2">{busy === reader.user_id ? "Saving…" : "Unblock"}</button></li>)}</ul> : <p className="mt-4 text-sm text-[var(--aepilog-muted)]">You haven’t blocked anyone.</p>}
    {error && <p role="alert" className="mt-3 text-sm text-[var(--aepilog-cherry)]">{error}</p>}
    <p className="mt-5 text-xs leading-5 text-[var(--aepilog-muted)]">aepilog counts signed-in visits once a day to understand whether readers return. This uses no tracking cookies and does not record which pages or books you view.</p>
    {moderator && <Link href="/admin" className="mt-5 inline-block text-sm font-medium underline">Reports and usage →</Link>}
  </section>;
}
