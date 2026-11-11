"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { attachedBookHref } from "@/lib/community-books";
import { POLL_FIELDS, pollPercentages, pollTotal, type BookPoll } from "@/lib/book-polls";
import { CommunityBookCover } from "./AttachedBookCard";

export default function BookPollCard({ poll, choice, onChoice, onUpdate }: { poll: BookPoll; choice: string | null; onChoice: (choice: string) => void; onUpdate: (poll: BookPoll) => void }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false), [error, setError] = useState("");
  const [showResults, setShowResults] = useState(false);
  const percentages = pollPercentages(Number(poll.left_votes), Number(poll.right_votes));
  async function vote(side: "left" | "right") {
    if (saving) return;
    setSaving(true); setError(""); let recorded = false;
    try {
      const { data } = await supabase.auth.getUser();
      if (!data.user || data.user.is_anonymous) {
        sessionStorage.setItem("nextchapter_return_after_auth", window.location.href); router.push("/auth"); return;
      }
      const result = await supabase.rpc("cast_book_vote", { p_poll: poll.post_id, p_choice: side }).abortSignal(AbortSignal.timeout(10000));
      if (result.error) throw result.error;
      recorded = true; onChoice(side);
      const updated = await supabase.from("book_polls").select(POLL_FIELDS).eq("post_id", poll.post_id).abortSignal(AbortSignal.timeout(5000)).single();
      if (updated.error) throw updated.error;
      onUpdate(updated.data as unknown as BookPoll);
    } catch { setError(recorded ? "Your vote was saved, but results could not refresh. Refresh the page to see them." : "Could not save your vote. Please try again."); }
    finally { setSaving(false); }
  }
  return <div className="mt-4">
    <div role="group" aria-label="Book versus book poll" className="grid grid-cols-2 gap-3">
      {(["left", "right"] as const).map((side) => {
        const book = side === "left" ? poll.left_book : poll.right_book;
        if (!book) return <p key={side} className="text-xs text-[#756866]">Book unavailable</p>;
        return <div key={side} className="min-w-0">
          <button type="button" disabled={saving} onClick={() => void vote(side)} aria-label={`Vote for ${book.title}`} aria-pressed={choice === side} className={`flex h-full w-full flex-col items-center rounded-2xl border p-3 text-center transition disabled:opacity-60 ${choice === side ? "border-[#8f2635] bg-[#f6e8e6]" : "border-[#e6d8d4] bg-[#fffdf9] hover:border-[#8f2635]"}`}>
            <CommunityBookCover book={book} large />
            <span className="aepilog-heading mt-3 block break-words text-base leading-6 text-[#3a2b2b]">{book.title}</span><span className="mt-1 block text-xs text-[#756866]">{book.author}</span>
            {(choice || showResults) && <span className="mt-3 block text-lg font-semibold text-[#8f2635]">{percentages[side]}%</span>}
            {choice === side && <span className="mt-1 text-xs font-semibold text-[#8f2635]">Your vote</span>}
          </button>
        </div>;
      })}
    </div>
    <div className="mt-2 grid grid-cols-2 gap-3 text-center text-xs font-semibold text-[#8f2635]">{[poll.left_book,poll.right_book].map((book,i)=>book?<a key={i} href={attachedBookHref(book)} className="py-2 hover:underline">View book</a>:<span key={i} />)}</div>
    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[#756866]"><span>{pollTotal(poll)} {pollTotal(poll) === 1 ? "vote" : "votes"}{saving ? " · Saving…" : ""}</span>{!choice && <button type="button" onClick={() => setShowResults((value) => !value)} className="py-2 font-semibold text-[#8f2635]">{showResults ? "Hide results" : "View results"}</button>}</div>
    {error && <p role="alert" className="mt-2 text-xs leading-5 text-[#8f2635]">{error}</p>}
  </div>;
}
