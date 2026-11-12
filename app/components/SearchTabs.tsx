export default function SearchTabs({ active }: { active: "books" | "people" }) {
  return <nav aria-label="Search categories" className="mt-6 flex gap-2">
    {([{ label: "Books", href: "/search", value: "books" }, { label: "People", href: "/readers", value: "people" }] as const).map((tab) => <a key={tab.value} href={tab.href} aria-current={active === tab.value ? "page" : undefined} style={{ color: active === tab.value ? "#fff" : "var(--aepilog-cherry)" }} className={`min-w-22 rounded-full border px-5 py-2.5 text-center text-sm font-semibold ${active === tab.value ? "border-[var(--aepilog-cherry)] bg-[var(--aepilog-cherry)]" : "border-[var(--aepilog-border)] bg-[var(--aepilog-paper)]"}`}>{tab.label}</a>)}
  </nav>;
}
