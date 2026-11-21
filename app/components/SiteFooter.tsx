import Link from "next/link";
import Image from "next/image";
import cherry from "../icon.png";

const groups = [
  { title: "Explore", links: [["Community", "/"], ["Find Books", "/find-books"], ["Search", "/search"], ["Reading circles", "/buddy-reads"]] },
  { title: "aepilog", links: [["About", "/about"], ["Community guidelines", "/community-guidelines"], ["Privacy", "/privacy"]] },
  { title: "Need a hand?", links: [["Help", "/help"], ["Contact", "/contact"], ["Report a problem", "/help#reports"]] },
];

export default function SiteFooter() {
  return <footer className="border-t border-[var(--aepilog-rose-border)] bg-[var(--aepilog-rose-soft)] text-[var(--aepilog-ink)]">
    <div className="mx-auto max-w-6xl px-5 py-9 sm:py-12">
      <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="col-span-2 sm:col-span-3 lg:col-span-1">
          <Link href="/" aria-label="aepilog home" className="aepilog-wordmark inline-flex items-center gap-2 text-3xl">
            <Image src={cherry} alt="" width={32} height={32} unoptimized />aepilog
          </Link>
          <p className="mt-3 max-w-60 text-sm leading-6 text-[var(--aepilog-muted)]">For everyone who finishes a book and still wants to talk about it.</p>
        </div>
        {groups.map((group, index) => <nav key={group.title} aria-label={`Footer ${group.title}`} className={index === 2 ? "col-span-2 sm:col-span-1" : undefined}>
          <h2 className="text-sm font-semibold">{group.title}</h2>
          <ul className={index === 2 ? "mt-3 flex flex-wrap gap-x-5 sm:block sm:space-y-1" : "mt-3 space-y-1"}>{group.links.map(([label, href]) => <li key={href}><Link href={href} prefetch={false} className="inline-block py-1.5 text-sm underline-offset-4 hover:underline">{label}</Link></li>)}</ul>
        </nav>)}
      </div>
      <div className="mt-8 border-t border-[var(--aepilog-rose-border)] pt-5 text-xs text-[var(--aepilog-muted)]">© {new Date().getFullYear()} aepilog</div>
    </div>
  </footer>;
}
