"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import SiteHeader from "../../../components/SiteHeader";
import BackLink from "../../../components/BackLink";
import { useReaderViewer } from "../../../components/ReaderSocial";
import { supabase } from "@/lib/supabase";
import { buddyHref } from "@/lib/buddy-reads";

export default function JoinBuddyRead({ token }: { token: string }) {
  const viewer = useReaderViewer();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function join() {
    if (!viewer || busy) return;
    setBusy(true); setError("");
    try {
      const { data, error } = await supabase.rpc("join_buddy_read", { p_token: token }).abortSignal(AbortSignal.timeout(10000));
      if (error || typeof data !== "string") throw error;
      router.replace(buddyHref(data));
    } catch { setError("Could not join. The invite may have been reset, the group may be full, or the connection may have failed. Ask the host for a fresh link or try again."); }
    finally { setBusy(false); }
  }
  return <main className="min-h-screen bg-[var(--aepilog-cream)] text-[var(--aepilog-ink)]"><SiteHeader active="community" /><section className="mx-auto max-w-xl px-4 py-8"><BackLink fallback="/buddy-reads" className="text-sm underline" /><div className="mt-6 rounded-3xl border border-[var(--aepilog-border)] bg-[var(--aepilog-paper)] p-6"><h1 className="aepilog-heading text-3xl">Join a reading circle</h1><p className="mt-3 text-sm leading-6 text-[var(--aepilog-muted)]">You’ve been invited to a private reading group. Join to see its book, members and conversation. Other members will see your display name and messages.</p>{error && <p role="alert" className="mt-4 text-sm text-[var(--aepilog-cherry)]">{error}</p>}
    {viewer === undefined ? <p role="status" className="mt-5">Checking your account...</p> : viewer ? <button type="button" onClick={() => void join()} disabled={busy} className="mt-5 rounded-full bg-[var(--aepilog-cherry)] px-5 py-2.5 text-sm disabled:opacity-50" style={{ color: "var(--aepilog-paper)" }}>{busy ? "Joining..." : "Join reading circle"}</button> : <Link href="/auth" onClick={() => sessionStorage.setItem("nextchapter_return_after_auth", window.location.href)} className="mt-5 inline-block rounded-full bg-[var(--aepilog-cherry)] px-5 py-2.5 text-sm" style={{ color: "var(--aepilog-paper)" }}>Sign in to join</Link>}
  </div></section></main>;
}
