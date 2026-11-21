import type { ReactNode } from "react";
import BackLink from "../components/BackLink";

export default function InformationLayout({ children }: { children: ReactNode }) {
  return <main className="bg-[var(--aepilog-cream)] text-[var(--aepilog-ink)]"><div className="mx-auto max-w-3xl px-5 py-8 sm:py-12">
    <BackLink fallback="/" className="inline-block py-2 text-sm underline underline-offset-4" />
    <div className="aepilog-info mt-7">{children}</div>
  </div></main>;
}
