"use client";

import SiteHeader from "../components/SiteHeader";
import { ReaderProfileSettings, useReaderViewer } from "../components/ReaderSocial";

export default function SettingsPage() {
  const viewerId = useReaderViewer();
  return <main className="min-h-screen bg-[var(--aepilog-cream)] text-[var(--aepilog-ink)]">
    <SiteHeader active="profile" />
    <div className="mx-auto max-w-3xl px-4 py-7 sm:px-5 sm:py-10">
      <a href="/profile" className="inline-block py-2 text-sm underline underline-offset-4">← Back to profile</a>
      <h1 className="aepilog-heading mt-4 text-3xl sm:text-4xl">Settings</h1>
      {viewerId === undefined ? <p role="status" className="mt-6 text-sm">Loading settings...</p> : viewerId ?
        <ReaderProfileSettings key={viewerId} userId={viewerId} /> :
        <div className="mt-6 rounded-2xl border border-[var(--aepilog-border)] bg-[var(--aepilog-paper)] p-6">
          <p>Sign in to manage your privacy settings.</p>
          <a href="/auth" onClick={() => sessionStorage.setItem("nextchapter_return_after_auth", window.location.href)} className="mt-4 inline-block rounded-full bg-[var(--aepilog-cherry)] px-5 py-2.5" style={{ color: "var(--aepilog-paper)" }}>Sign in</a>
        </div>}
    </div>
  </main>;
}
