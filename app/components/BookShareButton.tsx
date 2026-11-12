"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createShareCard, shareFilename, type ShareCard } from "@/lib/share-card";

function ShareDialog({ book, rating, readerName, onClose }: ShareCard & { onClose: () => void }) {
  const [includeRating, setIncludeRating] = useState(typeof rating === "number" && rating >= 1 && rating <= 5);
  const [asset, setAsset] = useState<{ key: string; url: string; file: File } | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [sharing, setSharing] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const key = JSON.stringify([book.title, book.author, book.cover, book.href, rating, readerName, includeRating, attempt]);
  const url = asset?.key === key ? asset.url : "";
  const file = asset?.key === key ? asset.file : null;
  const panel = useRef<HTMLDivElement>(null);
  const heading = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow; document.body.style.overflow = "hidden";
    panel.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;
      const nodes = panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled)');
      if (!nodes?.length) return;
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", key);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", key); previous?.focus(); };
  }, [onClose]);
  useEffect(() => {
    let current = true; let preview: string | null = null;
    const [title, author, cover, href, score, name, rated] = JSON.parse(key);
    void createShareCard({ book: { title, author, cover, href }, rating: rated ? score : null, readerName: name }).then((blob) => {
      if (!current) return;
      preview = URL.createObjectURL(blob);
      setAsset({ key, url: preview, file: new File([blob], shareFilename(title), { type: "image/png" }) });
      setError("");
    }).catch(() => { if (current) setError("Could not create your card. Please try again."); });
    return () => { current = false; if (preview) URL.revokeObjectURL(preview); };
  }, [key]);

  const canShare = !!file && typeof navigator !== "undefined" && !!navigator.canShare?.({ files: [file] });
  async function share() {
    if (!file || sharing) return;
    setSharing(true); setError("");
    try { await navigator.share({ files: [file], title: book.title }); }
    catch (error) { if (!(error instanceof Error && error.name === "AbortError")) setError("Sharing is unavailable here. You can download the card instead."); }
    finally { setSharing(false); }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(new URL(book.href, window.location.origin).href); setStatus("Book link copied."); }
    catch { setError("Could not copy the link. You can copy the book page address from your browser."); }
  }
  return <div className="aepilog-overlay fixed inset-0 z-[70] flex items-center justify-center bg-stone-900/45 p-4 backdrop-blur-[2px]" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={heading} className="aepilog-panel max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-[28px] border border-[var(--aepilog-border)] bg-[var(--aepilog-paper)] p-5 shadow-xl sm:p-6">
      <div className="flex items-center justify-between gap-4"><h2 id={heading} className="aepilog-heading text-2xl text-[var(--aepilog-ink)]">Share this chapter</h2><button type="button" onClick={onClose} aria-label="Close sharing" className="rounded-full px-3 py-2 text-lg text-[var(--aepilog-cherry)]">×</button></div>
      <p className="mt-2 text-sm leading-6 text-[var(--aepilog-muted)]">A card for your Instagram Story or wherever you share your reading.</p>
      <div className="mx-auto mt-4 flex aspect-[9/16] w-[180px] items-center justify-center overflow-hidden rounded-xl border border-[var(--aepilog-border)] bg-[var(--aepilog-cream)] sm:w-[210px]">
        {url ? <img src={url} alt={`Sharing card for ${book.title}${includeRating ? `, rated ${rating} out of 5` : ""}`} className="h-full w-full" /> : <p role="status" className="px-4 text-center text-sm text-[var(--aepilog-muted)]">{error ? "Preview unavailable" : "Creating your card…"}</p>}
      </div>
      {typeof rating === "number" && rating >= 1 && rating <= 5 && <label className="mt-4 flex items-center gap-2 text-sm text-[var(--aepilog-muted)]"><input type="checkbox" checked={includeRating} onChange={(event) => { setIncludeRating(event.target.checked); setError(""); setStatus(""); }} className="accent-[#8f2635]" />Include my rating{readerName ? " and display name" : ""}</label>}
      <div className="mt-4 flex flex-wrap gap-2">
        {canShare && <button type="button" disabled={sharing} onClick={() => void share()} className="rounded-full bg-[var(--aepilog-cherry)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{sharing ? "Sharing…" : "Share image"}</button>}
        {url && <a href={url} download={shareFilename(book.title)} className="rounded-full border border-[var(--aepilog-border)] px-4 py-2.5 text-sm font-semibold text-[var(--aepilog-cherry)]">Download card</a>}
        <button type="button" onClick={() => void copy()} className="rounded-full border border-[var(--aepilog-border)] px-4 py-2.5 text-sm font-semibold text-[var(--aepilog-cherry)]">Copy book link</button>
      </div>
      <p className="mt-3 text-xs leading-5 text-[var(--aepilog-muted)]">Save the image, then add it to your Story. Reviews and spoilers aren’t included.</p>
      {status && <p role="status" className="mt-3 text-sm text-[var(--aepilog-muted)]">{status}</p>}
      {error && <p role="alert" className="mt-3 text-sm text-[var(--aepilog-cherry)]">{error} {!file && <button type="button" onClick={() => setAttempt((value) => value + 1)} className="underline">Try again</button>}</p>}
    </div>
  </div>;
}

export default function BookShareButton(props: ShareCard) {
  const [open, setOpen] = useState(false);
  // Stable modal callbacks keep focus management intact as the preview updates.
  const close = useCallback(() => setOpen(false), []);
  return <>
    <button type="button" onClick={() => setOpen(true)} className="rounded-full border border-[var(--aepilog-border)] bg-[var(--aepilog-paper)] px-4 py-2.5 text-sm font-semibold text-[var(--aepilog-cherry)] transition hover:bg-[var(--aepilog-blush-light)]">Share book</button>
    {open && <ShareDialog {...props} onClose={close} />}
  </>;
}
