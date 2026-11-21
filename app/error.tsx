"use client";

import Link from "next/link";

export default function PageError({ retry }: { error: unknown; retry: () => void }) {
  return <main className="min-h-screen bg-[var(--aepilog-cream)] text-[var(--aepilog-ink)]">

    <section className="mx-auto max-w-lg px-5 py-16 text-center">
      <h1 className="aepilog-heading text-3xl">This page couldn’t load.</h1>
      <p className="mt-4 text-sm leading-6 text-[var(--aepilog-muted)]">Please try again, or head back to the community.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={retry} className="rounded-full bg-[var(--aepilog-cherry)] px-5 py-3" style={{ color: "var(--aepilog-paper)" }}>Try again</button>
        <Link href="/" className="rounded-full border border-[var(--aepilog-border)] px-5 py-3">Community</Link>
      </div>
    </section>
  </main>;
}
