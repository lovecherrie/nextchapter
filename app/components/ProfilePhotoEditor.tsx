"use client";

import { useEffect, useRef, useState } from "react";
import { getReader, type Reader } from "@/lib/readers";
import { readAccountCache } from "@/lib/account-cache";
import { prepareReaderPhoto, saveReaderPhoto } from "@/lib/reader-photos";
import { rememberReaderPhoto } from "@/lib/reader-portraits";
import { ReaderAvatar } from "./ReaderSocial";

export default function ProfilePhotoEditor({ userId, name }: { userId: string; name: string }) {
  const cached = readAccountCache<Reader>("reader");
  const own = cached?.user_id === userId ? cached : undefined;
  const [path, setPath] = useState<string | null>(own?.avatar_path || null);
  const [draft, setDraft] = useState<{ blob: Blob; url: string } | null>(null);
  const preview = draft?.url;
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(!!own);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  useEffect(() => {
    let current = true;
    void getReader(userId).then((reader) => {
      if (current && reader) { setPath(reader.avatar_path || null); setReady(true); }
      else if (current) setError("Your reader profile is unavailable. Refresh to try again.");
    }).catch(() => { if (current) setError("Could not load your photo. Refresh to try again."); });
    return () => { current = false; };
  }, [userId]);
  useEffect(() => () => { if (draft) URL.revokeObjectURL(draft.url); }, [draft]);
  async function select(file: File | undefined) {
    if (!file || busy || !ready) return;
    setBusy(true); setError(""); setStatus("");
    try { const blob = await prepareReaderPhoto(file); setDraft({ blob, url: URL.createObjectURL(blob) }); }
    catch (error) { setError(error instanceof Error ? error.message : "Could not open that photo."); }
    finally { setBusy(false); if (input.current) input.current.value = ""; }
  }
  async function save(photo: Blob | null) {
    if (busy || !ready) return;
    setBusy(true); setError(""); setStatus("");
    try {
      const updated = await saveReaderPhoto(userId, photo, path);
      setPath(updated); rememberReaderPhoto(userId, updated); setDraft(null); setOpen(false);
      setStatus(photo ? "Photo saved." : "Photo removed.");
    } catch { setError("Could not save your photo. Your current photo is unchanged. Please try again."); }
    finally { setBusy(false); }
  }
  return <div ref={root} className="relative flex w-20 shrink-0 flex-col items-center gap-2">
    <button ref={trigger} type="button" aria-label="Edit profile photo" aria-expanded={open || !!draft} disabled={busy || !ready} onClick={() => setOpen((value) => !value)} className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#8f2635]">
      {preview ? <img src={preview} alt="New profile photo preview" className="h-20 w-20 rounded-full object-cover" /> : <ReaderAvatar name={name} path={path} large />}
    </button>
    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Choose profile photo" className="sr-only" onChange={(event) => void select(event.target.files?.[0])} disabled={busy || !ready} />
    {(open || draft) && <div role="group" aria-label="Photo options" className="aepilog-reveal absolute left-0 top-full z-30 mt-2 w-56 rounded-2xl border border-[var(--aepilog-border)] bg-[var(--aepilog-paper)] p-4 shadow-lg">
    {draft ? <>
      <p className="text-center text-xs leading-5 text-[var(--aepilog-muted)]">Your photo will appear with your public activity.</p>
      <div className="flex gap-3 text-xs font-semibold text-[var(--aepilog-cherry)]">
        <button type="button" disabled={busy} onClick={() => void save(draft.blob)}>{busy ? "Saving…" : "Save photo"}</button>
        <button type="button" disabled={busy} onClick={() => { setDraft(null); setOpen(false); }}>Cancel</button>
      </div>
    </> : <div className="flex flex-wrap justify-center gap-3 text-xs font-semibold text-[var(--aepilog-cherry)]">
      <button type="button" disabled={busy || !ready} onClick={() => input.current?.click()}>{!ready ? "Loading photo…" : busy ? "Preparing…" : path ? "Change photo" : "Add photo"}</button>
      {path && <button type="button" disabled={busy} onClick={() => void save(null)}>Remove photo</button>}
    </div>}
    </div>}
    {status && <p role="status" className="sr-only">{status}</p>}
    {error && <p role="alert" className="w-40 text-center text-xs leading-5 text-[var(--aepilog-cherry)]">{error}</p>}
  </div>;
}
