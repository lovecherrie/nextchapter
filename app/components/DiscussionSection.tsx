"use client";

export default function DiscussionSection({ value, onChange, disabled = false }: { value: string | null; onChange: (value: string | null) => void; disabled?: boolean }) {
  return <div className="flex flex-wrap items-center gap-2 text-xs text-[#756866]">
    <label className="flex items-center gap-2">Section
      <select aria-label="Book section" disabled={disabled} value={value?.startsWith("chapter:") ? "chapter" : value || "whole"} onChange={(event) => onChange(event.target.value === "chapter" ? "chapter:1" : event.target.value === "epilogue" ? "epilogue" : null)} className="rounded-lg border border-[#e6d8d4] bg-white px-2 py-1.5">
        <option value="whole">Whole book</option><option value="chapter">Chapter</option><option value="epilogue">Epilogue</option>
      </select>
    </label>
    {value?.startsWith("chapter:") && <input aria-label="Chapter number" type="number" min="1" max="1000" step="1" required disabled={disabled} value={value.slice(8)} onChange={(event) => onChange(`chapter:${event.target.value}`)} className="w-20 rounded-lg border border-[#e6d8d4] bg-white px-2 py-1.5" />}
  </div>;
}
