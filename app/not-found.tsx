import Link from "next/link";

export default function NotFound() {
  return <main className="min-h-screen bg-[var(--aepilog-cream)] text-[var(--aepilog-ink)]">

    <section className="mx-auto max-w-lg px-5 py-16 text-center">
      <p className="text-sm text-[var(--aepilog-muted)]">404</p>
      <h1 className="aepilog-heading mt-3 text-3xl">This page isn’t here.</h1>
      <p className="mt-4 text-sm leading-6 text-[var(--aepilog-muted)]">The link may have changed. You can still find a book or join a conversation.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/" className="rounded-full bg-[var(--aepilog-cherry)] px-5 py-3" style={{ color: "var(--aepilog-paper)" }}>Community</Link>
        <Link href="/search" className="rounded-full border border-[var(--aepilog-border)] px-5 py-3">Search for books</Link>
      </div>
    </section>
  </main>;
}
