import BackLink from "../../components/BackLink";
import SiteHeader from "../../components/SiteHeader";

export default function DiscussionNotFound() {
  return <main className="min-h-screen bg-[var(--aepilog-cream)] text-[var(--aepilog-ink)]">
    <SiteHeader active="community" />
    <section className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="aepilog-heading text-3xl">Discussion not found</h1>
      <p className="mt-3 text-sm text-[var(--aepilog-muted)]">This link is invalid or the discussion is no longer available.</p>
      <BackLink className="mt-5 inline-block underline underline-offset-4" />
    </section>
  </main>;
}
