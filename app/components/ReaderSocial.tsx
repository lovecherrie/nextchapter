"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { avatarUrl } from "@/lib/reader-photos";
import { readerPortrait, rememberReaderPhoto } from "@/lib/reader-portraits";
import { currentReaderId, getReader, readerHref, setReaderFollowing, updateReaderVisibility, validReaderId, type Reader } from "@/lib/readers";

export function ReaderName({ userId, name, className = "" }: { userId: string; name: string; className?: string }) {
  const [path, setPath] = useState<string | null>(null);
  useEffect(() => {
    if (!validReaderId(userId)) return;
    let current = true;
    void readerPortrait(userId).then((value) => { if (current) setPath(value); });
    const changed = (event: Event) => {
      const photo = (event as CustomEvent<{ userId: string; path: string | null }>).detail;
      if (photo.userId === userId) { rememberReaderPhoto(userId, photo.path); setPath(photo.path); }
    };
    window.addEventListener("aepilog-photo-changed", changed);
    return () => { current = false; window.removeEventListener("aepilog-photo-changed", changed); };
  }, [userId]);
  return validReaderId(userId)
    ? <a href={readerHref(userId)} className={`inline-flex items-center gap-2 hover:underline ${className}`}><ReaderAvatar name={name} path={path} small />{name}</a>
    : <span className={className}>{name}</span>;
}

export function useReaderViewer() {
  const [viewerId, setViewerId] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let current = true;
    void currentReaderId().then((id) => { if (current) setViewerId(id); }).catch(() => { if (current) setViewerId(null); });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") setViewerId(null);
      if (event === "SIGNED_IN") setViewerId(session?.user && !session.user.is_anonymous ? session.user.id : null);
    });
    return () => { current = false; data.subscription.unsubscribe(); };
  }, []);
  return viewerId;
}

export function ReaderAvatar({ name, path, large = false, small = false }: { name: string; path?: string | null; large?: boolean; small?: boolean }) {
  const [failed, setFailed] = useState<string | null>(null);
  const url = avatarUrl(path);
  return <div aria-hidden="true" className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--aepilog-blush)] font-semibold text-[var(--aepilog-cherry)] ${large ? "h-20 w-20 text-3xl" : small ? "h-7 w-7 text-xs" : "h-12 w-12 text-lg"}`}>
    {url && failed !== url ? <img src={url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" onError={() => setFailed(url)} /> : Array.from(name.trim())[0]?.toUpperCase() || "R"}
  </div>;
}

export function FollowButton({ reader, viewerId, following, onChange }: {
  reader: Reader; viewerId: string | null | undefined; following: boolean; onChange: (following: boolean) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  if (viewerId === reader.user_id) return <a href="/profile" className="rounded-full border border-[var(--aepilog-border)] px-4 py-2.5 text-sm font-semibold text-[var(--aepilog-cherry)]">Edit profile</a>;

  async function toggle() {
    if (saving || viewerId === undefined) return;
    if (!viewerId) {
      sessionStorage.setItem("nextchapter_return_after_auth", window.location.href);
      router.push("/auth");
      return;
    }
    setSaving(true); setError("");
    try {
      if (!following) {
        const own = await getReader(viewerId);
        if (!own?.is_public) {
          setError("Make your reader profile public before following other readers.");
          return;
        }
      }
      await setReaderFollowing(viewerId, reader.user_id, !following);
      onChange(!following);
    } catch {
      setError("Could not update following. Please try again.");
    } finally { setSaving(false); }
  }
  return <div className="shrink-0">
    <button type="button" onClick={toggle} disabled={saving || viewerId === undefined}
      aria-label={`${following ? "Unfollow" : "Follow"} ${reader.display_name}`}
      className={`rounded-full border px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50 ${following ? "border-[var(--aepilog-border)] bg-[var(--aepilog-paper)] text-[var(--aepilog-cherry)] hover:bg-[var(--aepilog-blush-light)]" : "border-[var(--aepilog-cherry)] bg-[var(--aepilog-cherry)] text-white hover:bg-[var(--aepilog-cherry-hover)]"}`}>
      {saving ? "Saving..." : viewerId === undefined ? "Loading..." : following ? "Following" : "Follow"}
    </button>
    {error && <p role="alert" className="mt-2 max-w-56 text-xs leading-5 text-[var(--aepilog-cherry)]">{error} <a href="/profile" className="underline">Your profile</a></p>}
  </div>;
}

export function ReaderTile({ reader, viewerId, following, onFollowChange }: {
  reader: Reader; viewerId: string | null | undefined; following: boolean; onFollowChange: (following: boolean) => void;
}) {
  return <article className="rounded-[22px] border border-[var(--aepilog-border)] bg-[var(--aepilog-paper)] p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <a href={readerHref(reader.user_id)} className="flex min-w-0 flex-1 items-center gap-3">
        <ReaderAvatar name={reader.display_name} path={reader.avatar_path} />
        <div className="min-w-0">
          <h2 className="aepilog-heading break-words text-xl font-medium text-[var(--aepilog-ink)]">{reader.display_name}</h2>
          <p className="mt-1 text-xs text-[var(--aepilog-muted)]">{reader.follower_count} {Number(reader.follower_count) === 1 ? "follower" : "followers"}</p>
        </div>
      </a>
      <FollowButton reader={reader} viewerId={viewerId} following={following} onChange={onFollowChange} />
    </div>
    {reader.bio && <p className="mt-3 break-words text-sm leading-6 text-[var(--aepilog-muted)]">{reader.bio}</p>}
  </article>;
}

export function ReaderProfileSettings({ userId }: { userId: string }) {
  const [reader, setReader] = useState<Reader | null>(null);
  const [isPublic, setIsPublic] = useState(true);
  const [showActivity, setShowActivity] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    let current = true;
    void getReader(userId).then((profile) => {
      if (!current) return;
      setReader(profile);
      if (profile) { setIsPublic(profile.is_public); setShowActivity(profile.show_activity); }
    }).catch(() => { if (current) setError("Your public reader profile is unavailable right now. Please try again later."); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [userId]);

  async function save() {
    if (saving) return;
    setSaving(true); setSaved(false); setError("");
    try { await updateReaderVisibility(userId, isPublic, showActivity); setSaved(true); }
    catch { setError("Could not save your visibility choices. Please try again."); }
    finally { setSaving(false); }
  }
  return <section className="mt-6 rounded-[28px] border border-[var(--aepilog-border)] bg-[var(--aepilog-paper)] p-6 md:p-7">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-semibold">Your public reader profile</h2>
      <Link href="/readers" className="text-sm font-semibold text-[var(--aepilog-cherry)]">Find readers</Link>
    </div>
    {loading ? <p className="mt-4 text-sm text-[var(--aepilog-muted)]">Loading visibility choices...</p> : reader ? <>
      <p className="mt-2 text-sm leading-6 text-[var(--aepilog-muted)]">Your public profile uses the display name and bio above. Your email and Want to Read list stay private.</p>
      <label className="mt-5 flex items-start gap-3 text-sm"><input type="checkbox" checked={isPublic} onChange={(event) => { setIsPublic(event.target.checked); setSaved(false); }} className="mt-1 accent-[#8f2635]" />Let other readers find and follow me</label>
      <label className="mt-3 flex items-start gap-3 text-sm"><input type="checkbox" checked={showActivity} onChange={(event) => { setShowActivity(event.target.checked); setSaved(false); }} className="mt-1 accent-[#8f2635]" />Show my ratings and discussions on my reader profile</label>
      <p className="mt-2 text-xs leading-5 text-[var(--aepilog-muted)]">Posts and ratings you share on book and community pages remain visible there.</p>
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <button type="button" onClick={save} disabled={saving} className="rounded-full bg-[var(--aepilog-cherry)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving..." : "Save visibility"}</button>
        <a href={readerHref(userId)} className="text-sm font-semibold text-[var(--aepilog-cherry)]">View my reader profile</a>
        {saved && <p role="status" className="text-sm text-[var(--aepilog-muted)]">Visibility saved.</p>}
      </div>
    </> : !error && <p className="mt-4 text-sm text-[var(--aepilog-muted)]">Your public reader profile is unavailable right now. Please try again later.</p>}
    {error && <p role="alert" className="mt-4 text-sm text-[var(--aepilog-cherry)]">{error}</p>}
  </section>;
}
