"use client";

import Link from "next/link";
import { useState } from "react";

export type ConversationBook = {
  key: string;
  title: string;
  author: string | null;
  cover: string | null;
  href: string;
  posts: number;
};

export default function ConversationBooks({ books }: { books: ConversationBook[] }) {
  const [failed, setFailed] = useState<string[]>([]);
  return <aside aria-label="Books being discussed" className="min-w-0 rounded-[24px] border border-[var(--aepilog-rose-border)] bg-[var(--aepilog-rose-paper)] p-4 sm:p-5">
    <h2 className="aepilog-heading text-xl font-medium text-[#3a2b2b]">Books being discussed</h2>
    <p className="mt-1 text-xs text-[#756866]">Across the community</p>
    <div className="mt-4 flex gap-4 overflow-x-auto pb-2 lg:grid lg:grid-cols-2 lg:gap-x-4 lg:gap-y-5 lg:overflow-visible lg:pb-0">
      {books.map((book) => <Link key={book.key} href={book.href} aria-label={`${book.title}${book.author ? ` by ${book.author}` : ""}, ${book.posts} ${book.posts === 1 ? "post" : "posts"}`} className="w-[76px] shrink-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#8f2635] sm:w-[88px] lg:w-auto">
        <div className="aspect-[2/3] overflow-hidden rounded-lg bg-[#ead5d0] shadow-sm">
          {book.cover && !failed.includes(book.key) ? <img src={book.cover} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" onError={() => setFailed((previous) => [...previous, book.key])} /> : <div className="flex h-full items-center justify-center p-2 text-center text-xs leading-4 text-[#7e454d]">{book.title}</div>}
        </div>
        <p className="mt-2 line-clamp-2 min-h-8 text-xs font-medium leading-4 text-[#4f4140]">{book.title}</p>
        <p className="mt-1 text-[11px] text-[#897471]">{book.posts} {book.posts === 1 ? "post" : "posts"}</p>
      </Link>)}
    </div>
  </aside>;
}
