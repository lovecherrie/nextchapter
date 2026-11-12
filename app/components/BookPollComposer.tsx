"use client";
import { useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ensureCommunityBook, type BookChoice } from "@/lib/community-books";
import CommunityBookPicker from "./CommunityBookPicker";

export default function BookPollComposer({ onPosted, onBusy }: { onPosted: (id: string) => void; onBusy: (busy: boolean) => void }) {
  const requestKey = useRef<string | null>(null);
  const [left, setLeft] = useState<BookChoice | null>(null), [right, setRight] = useState<BookChoice | null>(null);
  const [question, setQuestion] = useState("");
  const [spoilers, setSpoilers] = useState(false), [saving, setSaving] = useState(false), [error, setError] = useState("");
  async function publish() {
    if (saving) return;
    setError("");
    if (!left || !right || !question.trim()) { setError("Choose two books and write a question."); return; }
    if (left.external_id === right.external_id || (left.title.trim().toLowerCase() === right.title.trim().toLowerCase() && left.author.trim().toLowerCase() === right.author.trim().toLowerCase())) { setError("Choose two different books."); return; }
    setSaving(true); onBusy(true);
    requestKey.current ||= crypto.randomUUID();
    try {
      const [first, second] = await Promise.all([ensureCommunityBook(left), ensureCommunityBook(right)]);
      const result = await supabase.rpc("create_book_poll", { p_left_book: first.id, p_right_book: second.id, p_question: question.trim(), p_spoilers: spoilers, p_request_id: requestKey.current }).abortSignal(AbortSignal.timeout(15000));
      if (result.error) throw result.error;
      if (typeof result.data !== "string") throw new Error("Poll confirmation unavailable");
      onPosted(result.data);
    } catch { setError("Could not publish this poll. Your choices are still here. Please try again."); }
    finally { setSaving(false); onBusy(false); }
  }
  return <div className="space-y-5 p-5 sm:p-7">
    <label className="block text-sm font-semibold text-[#756866]">Your question<textarea aria-label="Your question" value={question} disabled={saving} onChange={(event) => { requestKey.current = null; setQuestion(event.target.value); }} maxLength={280} rows={3} placeholder="Which one would you recommend?" className="mt-2 w-full resize-none rounded-xl border border-[#e6d8d4] bg-white px-4 py-3 font-normal text-[#3a2b2b] outline-none focus:border-[#8f2635]" /></label>
    <div className="grid gap-4 sm:grid-cols-2"><CommunityBookPicker label="First book" value={left} onChange={(book) => { requestKey.current = null; setLeft(book); }} disabled={saving} /><CommunityBookPicker label="Second book" value={right} onChange={(book) => { requestKey.current = null; setRight(book); }} disabled={saving} /></div>
    <label className="flex items-center gap-2 text-sm text-[#756866]"><input type="checkbox" checked={spoilers} disabled={saving} onChange={(event) => { requestKey.current = null; setSpoilers(event.target.checked); }} className="accent-[#8f2635]" />This poll contains spoilers</label>
    {error && <p role="alert" className="text-sm text-[#8f2635]">{error}</p>}
    <div className="flex justify-end"><button type="button" onClick={() => void publish()} disabled={saving} className="rounded-full bg-[#8f2635] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Posting…" : "Post poll"}</button></div>
  </div>;
}
