"use client";
import type { BookChoice } from "@/lib/community-books";
import CommunityBookPicker from "./CommunityBookPicker";

export default function ReplyBookPicker({ open, onOpenChange, value, onChange, disabled = false }: { open: boolean; onOpenChange: (open: boolean) => void; value: BookChoice | null; onChange: (book: BookChoice | null) => void; disabled?: boolean }) {
  return <div className="mt-3">
    {open || value ? <div className="aepilog-reveal rounded-xl border border-[#e6d8d4] bg-[#fffdf9] p-3"><CommunityBookPicker label="Book to recommend" value={value} onChange={onChange} disabled={disabled} /><button type="button" disabled={disabled} onClick={() => { onChange(null); onOpenChange(false); }} className="mt-2 py-2 text-xs font-semibold text-[#756866]">Cancel attachment</button></div> : <button type="button" disabled={disabled} onClick={() => onOpenChange(true)} className="rounded-full border border-[#e6d8d4] px-3 py-2 text-xs font-semibold text-[#8f2635]">Attach a book</button>}
  </div>;
}
