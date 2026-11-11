export default function SearchTabs({ active }: { active: "books" | "people" }) {
  return <nav aria-label="Search categories" className="mt-6 flex gap-2">
    {([{ label: "Books", href: "/search", value: "books" }, { label: "People", href: "/readers", value: "people" }] as const).map((tab) => <a key={tab.value} href={tab.href} aria-current={active === tab.value ? "page" : undefined} className={`rounded-full px-5 py-2.5 text-sm font-semibold ${active === tab.value ? "bg-[var(--aepilog-cherry)] text-white" : "border border-[var(--aepilog-border)] bg-[var(--aepilog-paper)] text-[var(--aepilog-cherry)]"}`}>{tab.label}</a>)}
  </nav>;
}
