"use client";

import { useEffect, useState } from "react";

export default function RecommendationProgress({ onCancel }: { onCancel: () => void }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--aepilog-border)] bg-[var(--aepilog-paper)] px-4 py-3 text-sm text-[var(--aepilog-muted)]">
    <p role="status">{seconds < 15 ? "Finding books that fit your taste…" : "Still finding your matches. This is taking a little longer…"} <span className="tabular-nums" aria-hidden="true">{seconds}s</span></p>
    <button type="button" onClick={onCancel} className="shrink-0 font-semibold text-[var(--aepilog-cherry)] underline underline-offset-4">Cancel</button>
  </div>;
}
