"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import SiteHeader from "../../components/SiteHeader";
import BackLink from "../../components/BackLink";
import { useReaderViewer, ReaderDisplayName } from "../../components/ReaderSocial";
import { supabase } from "@/lib/supabase";
import { BUDDY_FIELDS, type BuddyRead, type BuddyMember, type BuddyMessage } from "@/lib/buddy-reads";
import { attachedBookHref } from "@/lib/community-books";

const fieldClass = "mt-2 w-full rounded-xl border border-[var(--aepilog-border)] bg-white px-3 py-3 text-sm";
const buttonClass = "rounded-full border border-[var(--aepilog-border)] px-4 py-2 text-sm disabled:opacity-50";

export default function BuddyReadScreen({ id }: { id: string }) {
  const viewer = useReaderViewer();
  return <main className="min-h-screen bg-[var(--aepilog-cream)] text-[var(--aepilog-ink)]"><SiteHeader active="community" /><section className="mx-auto max-w-3xl px-4 py-7 sm:px-5 sm:py-10">
    <BackLink fallback="/buddy-reads" className="text-sm underline underline-offset-4" />
    {viewer === undefined ? <p role="status" className="mt-6">Loading buddy read...</p> : viewer ? <Room key={viewer} id={id} viewer={viewer} /> : <div className="mt-6"><h1 className="aepilog-heading text-3xl">Private buddy read</h1><p className="mt-3"><Link href="/auth" onClick={() => sessionStorage.setItem("nextchapter_return_after_auth", window.location.href)} className="underline">Sign in</Link> to open a group you’ve joined.</p></div>}
  </section></main>;
}

function Room({ id, viewer }: { id: string; viewer: string }) {
  const router = useRouter();
  const [group, setGroup] = useState<BuddyRead | null>(null);
  const [members, setMembers] = useState<BuddyMember[]>([]);
  const [messages, setMessages] = useState<BuddyMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(50);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const [content, setContent] = useState("");
  const [chapter, setChapter] = useState("0");
  const [revealed, setRevealed] = useState<string[]>([]);
  const [invite, setInvite] = useState<string | null>(null);
  const [copyState, setCopyState] = useState("");
  const pendingMessage = useRef<string | null>(null);
  const version = useRef(0);
  const owner = group?.owner_id === viewer;
  const load = useCallback(async (signal?: AbortSignal) => {
    const current = ++version.current;
    const deadline = signal ? AbortSignal.any([signal, AbortSignal.timeout(12000)]) : AbortSignal.timeout(12000);
    try {
      const result = await supabase.from("buddy_reads").select(BUDDY_FIELDS).eq("id", id).abortSignal(deadline).maybeSingle();
      if (signal?.aborted || current !== version.current) return;
      if (result.error) throw result.error;
      if (!result.data) { setGroup(null); setMessages([]); setMembers([]); setInvite(null); setError(""); return; }
      const [memberResult, messageResult] = await Promise.all([
        supabase.from("buddy_read_members").select("user_id,display_name,joined_at").eq("read_id", id).order("joined_at").abortSignal(deadline),
        supabase.from("buddy_read_messages").select("id,user_id,display_name,chapter,content,created_at", { count: "exact" }).eq("read_id", id).order("created_at", { ascending: false }).order("id", { ascending: false }).range(0, limit-1).abortSignal(deadline),
      ]);
      if (signal?.aborted || current !== version.current) return;
      if (memberResult.error || messageResult.error) throw memberResult.error || messageResult.error;
      // Membership may have been revoked between the group and message reads.
      if (!(memberResult.data || []).some((member) => member.user_id === viewer)) { setGroup(null); setMessages([]); setMembers([]); setInvite(null); return; }
      setGroup(result.data as unknown as BuddyRead); setMembers(memberResult.data || []); setMessages((messageResult.data || []).reverse()); setTotal(messageResult.count || 0); setError("");
    } catch { if (!signal?.aborted && current === version.current) setError("Could not refresh this buddy read. Please try again."); }
    finally { if (!signal?.aborted && current === version.current) setLoading(false); }
  }, [id, viewer, limit]);
  useEffect(() => {
    const controller = new AbortController();
    const initial = window.setTimeout(() => void load(controller.signal), 0);
    const refresh = () => { if (document.visibilityState !== "hidden") void load(controller.signal); };
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { controller.abort(); window.clearTimeout(initial); window.clearInterval(timer); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [load]);

  async function post() {
    if (!content.trim() || busy) return;
    const chapterNumber = Number(chapter);
    if (!/^\d+$/.test(chapter) || chapterNumber > 1000) { setActionError("Choose Before reading or a chapter from 1 to 1000."); return; }
    const self = members.find((member) => member.user_id === viewer);
    if (!self) return;
    setBusy(true); setActionError(""); pendingMessage.current ||= crypto.randomUUID();
    try {
      // A fixed ID makes a retry safe if the first response was lost.
      const { error } = await supabase.from("buddy_read_messages").insert({ id: pendingMessage.current, read_id: id, user_id: viewer, display_name: self.display_name, chapter: chapterNumber, content: content.trim() }).abortSignal(AbortSignal.timeout(10000));
      if (error) {
        if (error.code !== "23505") throw error;
        const existing = await supabase.from("buddy_read_messages").select("id").eq("id", pendingMessage.current).eq("read_id", id).eq("user_id", viewer).abortSignal(AbortSignal.timeout(10000)).maybeSingle();
        if (existing.error || !existing.data) throw error;
      }
      setContent(""); pendingMessage.current = null; await load();
    } catch { setActionError("Could not post your message. Your draft is still here. Please try again."); }
    finally { setBusy(false); }
  }
  async function showInvite(rotate = false) {
    if (!owner || busy) return;
    if (rotate && !window.confirm("Reset this invite? The old link will stop working. Existing members will stay.")) return;
    setBusy(true); setActionError(""); setCopyState("");
    try {
      const request = rotate ? supabase.from("buddy_read_invites").update({ token: crypto.randomUUID() }).eq("read_id", id).select("token") : supabase.from("buddy_read_invites").select("token").eq("read_id", id);
      const { data, error } = await request.abortSignal(AbortSignal.timeout(10000)).single();
      if (error || !data?.token) throw error;
      setInvite(`${window.location.origin}/buddy-reads/join/${data.token}`);
    } catch { setActionError("Could not load or reset the invite. Please try again."); }
    finally { setBusy(false); }
  }
  async function copyInvite() {
    if (!invite) return;
    try { await navigator.clipboard.writeText(invite); setCopyState("Invite copied"); }
    catch { setCopyState("Select the invite link below to copy it."); }
  }
  async function removeMessage(message: BuddyMessage) {
    if (busy || !window.confirm("Delete this message?")) return;
    setBusy(true); setActionError("");
    try {
      const { error } = await supabase.from("buddy_read_messages").delete().eq("id", message.id).eq("read_id", id).abortSignal(AbortSignal.timeout(10000));
      if (error) throw error;
      await load();
    } catch { setActionError("Could not delete this message. Please try again."); }
    finally { setBusy(false); }
  }
  async function leaveOrDelete() {
    if (busy || !window.confirm(owner ? "Delete this buddy read and all its messages for everyone?" : "Leave this buddy read? You’ll need an invite to rejoin. Your messages will stay in the group.")) return;
    setBusy(true); setActionError("");
    try {
      const request = owner ? supabase.from("buddy_reads").delete().eq("id", id).eq("owner_id", viewer) : supabase.from("buddy_read_members").delete().eq("read_id", id).eq("user_id", viewer);
      const { error } = await request.abortSignal(AbortSignal.timeout(10000));
      if (error) throw error;
      router.replace("/buddy-reads");
    } catch { setActionError("Could not complete that change. Please try again."); setBusy(false); }
  }
  if (loading) return <p role="status" className="mt-6">Loading buddy read...</p>;
  if (!group) return <div className="mt-6"><h1 className="aepilog-heading text-3xl">Private buddy read</h1><p className="mt-3 text-sm text-[var(--aepilog-muted)]">{error || "This group is unavailable, or you haven’t joined it. Ask the host for an invite link."}</p><button type="button" onClick={() => void load()} className={`${buttonClass} mt-4`}>Try again</button></div>;
  return <>
    <header className="mt-5 rounded-3xl border border-[var(--aepilog-border)] bg-[var(--aepilog-paper)] p-5 sm:p-6"><span className="text-xs text-[var(--aepilog-cherry)]">Private buddy read</span><h1 className="aepilog-heading mt-2 break-words text-3xl">{group.title}</h1>
      {group.books && <Link href={attachedBookHref(group.books)} className="mt-4 flex min-w-0 items-center gap-3">{group.books.cover_url && <img src={group.books.cover_url} alt="" className="h-16 w-11 shrink-0 rounded-md object-cover" />}<span className="min-w-0 break-words text-sm">{group.books.title}<span className="mt-1 block text-xs text-[var(--aepilog-muted)]">{group.books.author}</span></span></Link>}
      <details className="mt-5 text-sm"><summary className="cursor-pointer">{members.length} {members.length === 1 ? "reader" : "readers"}</summary><ul className="mt-3 space-y-2">{members.map((member) => <li key={member.user_id}><ReaderDisplayName name={member.display_name} />{member.user_id === group.owner_id ? " · host" : ""}</li>)}</ul></details>
      <div className="mt-5 flex flex-wrap gap-2">{owner && <button type="button" onClick={() => void showInvite()} disabled={busy} className={buttonClass}>Invite friends</button>}<button type="button" disabled={busy} onClick={() => void leaveOrDelete()} className={buttonClass}>{owner ? "Delete buddy read" : "Leave buddy read"}</button></div>
      {owner && invite && <div className="mt-4 rounded-2xl bg-[var(--aepilog-blush-light)] p-4"><p className="text-xs leading-5">Anyone with this invite can join. Share it privately.</p><label className="mt-3 block text-sm">Invite link<input readOnly value={invite} onFocus={(event) => event.target.select()} className={fieldClass} /></label><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => void copyInvite()} className={buttonClass}>Copy invite</button><button type="button" disabled={busy} onClick={() => void showInvite(true)} className={buttonClass}>Reset invite link</button></div>{copyState && <p role="status" className="mt-2 text-xs">{copyState}</p>}</div>}
    </header>
    {error && <p role="alert" className="mt-4 text-sm text-[var(--aepilog-cherry)]">{error} <button type="button" onClick={() => void load()} className="underline">Refresh</button></p>}
    {actionError && <p role="alert" className="mt-4 text-sm text-[var(--aepilog-cherry)]">{actionError}</p>}
    <section aria-label="Buddy read conversation" className="mt-7"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="aepilog-heading text-2xl">Conversation</h2><button type="button" onClick={() => void load()} className={buttonClass}>Refresh</button></div><p className="mt-2 text-xs leading-5 text-[var(--aepilog-muted)]">Chapter messages stay hidden until you reveal them. Keep “Before reading” messages spoiler-free. Chapter numbers can differ between editions.</p>
      {messages.length < total && <button type="button" onClick={() => setLimit((value) => value+50)} className={`${buttonClass} mt-4`}>Load earlier messages</button>}
      <div className="mt-5 space-y-3">{messages.map((message) => <article key={message.id} className="rounded-2xl border border-[var(--aepilog-border)] bg-[var(--aepilog-paper)] p-4"><div className="flex items-start justify-between gap-3"><span className="min-w-0 break-words text-sm font-medium"><ReaderDisplayName name={message.display_name} /></span><time dateTime={message.created_at} className="shrink-0 text-xs text-[var(--aepilog-muted)]">{new Date(message.created_at).toLocaleDateString(undefined,{ month: "short", day: "numeric" })}</time></div><p className="mt-2 text-xs text-[var(--aepilog-cherry)]">{message.chapter ? `Chapter ${message.chapter}` : "Before reading"}</p>
        {message.chapter > 0 && !revealed.includes(message.id) ? <button type="button" onClick={() => setRevealed((current) => [...current,message.id])} className="mt-3 w-full rounded-xl bg-[var(--aepilog-blush-light)] px-4 py-4 text-left text-sm text-[var(--aepilog-cherry)]">Reveal chapter {message.chapter} message</button> : <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">{message.content}</p>}
        <div className="mt-3 flex gap-4">{message.chapter > 0 && revealed.includes(message.id) && <button type="button" onClick={() => setRevealed((current) => current.filter((value) => value !== message.id))} className="text-xs underline">Hide message</button>}{(owner || message.user_id === viewer) && <button type="button" onClick={() => void removeMessage(message)} disabled={busy} className="text-xs text-[var(--aepilog-muted)] underline">Delete message</button>}</div>
      </article>)}</div>
      {!messages.length && <p className="mt-5 text-sm text-[var(--aepilog-muted)]">No messages yet. Say hello or share what you’re hoping for from this book.</p>}
    </section>
    <section aria-label="New buddy read message" className="mt-6 rounded-3xl border border-[var(--aepilog-border)] bg-[var(--aepilog-paper)] p-5"><label className="block text-sm">Message<textarea value={content} disabled={busy} onChange={(event) => { pendingMessage.current = null; setContent(event.target.value.slice(0,1000)); }} rows={4} className={fieldClass} placeholder="What do you think so far?" /></label><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-sm">Discussing<select value={chapter === "0" ? "before" : "chapter"} disabled={busy} onChange={(event) => { pendingMessage.current = null; setChapter(event.target.value === "before" ? "0" : "1"); }} className={fieldClass}><option value="before">Before reading · no spoilers</option><option value="chapter">A chapter · hidden until revealed</option></select></label>{chapter !== "0" && <label className="text-sm">Chapter number<input type="number" min="1" max="1000" step="1" value={chapter} disabled={busy} onChange={(event) => { pendingMessage.current = null; setChapter(event.target.value); }} className={fieldClass} /></label>}</div><div className="mt-4 flex items-center justify-between gap-3"><span className="text-xs text-[var(--aepilog-muted)]">{content.length}/1000</span><button type="button" onClick={() => void post()} disabled={busy || !content.trim()} className="rounded-full bg-[var(--aepilog-cherry)] px-5 py-2.5 text-sm disabled:opacity-50" style={{ color: "var(--aepilog-paper)" }}>{busy ? "Saving..." : "Post message"}</button></div></section>
  </>;
}
