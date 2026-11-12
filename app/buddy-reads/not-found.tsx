import SiteHeader from "../components/SiteHeader";
import BackLink from "../components/BackLink";

export default function BuddyNotFound() {
  return <main className="min-h-screen bg-[var(--aepilog-cream)] text-[var(--aepilog-ink)]"><SiteHeader active="community" /><section className="mx-auto max-w-3xl px-4 py-10"><BackLink fallback="/buddy-reads" className="text-sm underline" /><h1 className="aepilog-heading mt-5 text-3xl">Reading circle not found</h1><p className="mt-3 text-sm text-[var(--aepilog-muted)]">Check the link or ask the host for a new invite.</p></section></main>;
}
