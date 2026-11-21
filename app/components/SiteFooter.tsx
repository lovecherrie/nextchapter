import Link from "next/link";
import Image from "next/image";
import cherry from "../icon.png";

const links = [["About", "/about"], ["Help", "/help"], ["Contact", "/contact"], ["Community guidelines", "/community-guidelines"], ["Privacy", "/privacy"]];

export default function SiteFooter() {
  return <footer className="bg-[var(--aepilog-cherry)]" style={{ color: "var(--aepilog-paper)" }}>
    <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="flex shrink-0 items-center gap-3">
        <Link href="/" aria-label="aepilog home" className="aepilog-wordmark inline-flex items-center gap-2 text-[22px]">
          <Image src={cherry} alt="" width={24} height={24} unoptimized />aepilog
        </Link>
        <span className="text-[11px] opacity-80">© {new Date().getFullYear()}</span>
      </div>
      <nav aria-label="Footer information">
        <ul className="flex flex-wrap gap-x-4 gap-y-0">{links.map(([label, href]) => <li key={href}><Link href={href} prefetch={false} className="inline-block py-1 text-xs underline-offset-4 hover:underline">{label}</Link></li>)}</ul>
      </nav>
    </div>
  </footer>;
}
