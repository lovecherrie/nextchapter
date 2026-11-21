import Link from "next/link";
export const metadata = { title: "About aepilog", description: "A place for short book reactions, questions, recommendations and conversations after the last page." };

export default function AboutPage() {
  return <>
    <h1>About aepilog</h1>
    <p className="text-xl">Some books leave you with a lot to say.</p>
    <p>aepilog is a place for quick reactions, questions, unpopular opinions and the ending you’re still thinking about. You don’t need to write a long review to join in.</p>
    <h2>Start with a conversation</h2>
    <p>Ask about a particular book, compare two in a poll, or post a general question. You can agree, disagree, recommend something or just read along. Use spoiler warnings so other readers can choose what to open.</p>
    <h2>Find something you want to read</h2>
    <p>Search by title or author, or tell Find Books what you love and what you’re looking for. Fiction, nonfiction, manga and mixed tastes all belong here.</p>
    <h2>A shelf that feels like yours</h2>
    <p>Show your Top 4, keep a private Want to Read list, and save dated reviews when you read a book again. Follow readers you enjoy, or read together in a private reading circle.</p>
    <div className="mt-7 flex flex-wrap gap-3"><Link href="/" className="aepilog-info-button">Browse discussions</Link><Link href="/find-books" className="aepilog-info-secondary">Find a book</Link></div>
  </>;
}
