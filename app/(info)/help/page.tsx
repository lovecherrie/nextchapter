import Link from "next/link";
export const metadata = { title: "Help", description: "Help with discussions, spoilers, profiles, recommendations and reading circles on aepilog." };
const questions = [
  ["Do I have to choose a book to post?", "No. Choose Create post in Community and write your question or opinion. Add a book if it helps, or leave it out for a general conversation. The same composer also lets you create a Book vs book poll."],
  ["How do spoilers and chapter labels work?", "Mark a post or review as containing spoilers before publishing. For discussions, you can also choose a chapter or Epilogue. The chapter label adds context; it does not automatically turn on the spoiler warning. In reading circles, chapter messages stay hidden until a reader chooses to reveal them."],
  ["Can I review a book more than once?", "Yes. Open the book’s rating form and choose Add another review for a reread. Each review keeps its posting date. Edit review changes an existing entry. The book’s average uses each reader’s latest review."],
  ["What can other readers see on my profile?", "Your public profile can show your display name, photo, bio, Top 4 and shared activity. You can change visibility in Settings. Your email and Want to Read list stay private. Changing profile visibility does not remove posts or reviews you already shared on public book and community pages."],
  ["How does Following work?", "Follow someone from their reader profile, then choose Following in Community to see their posts. Top and Newest let you return to the wider community. You can combine Following with the genre, author and spoiler-free filters."],
  ["How do I start a reading circle?", "Open Reading circles, choose a book and create your group. Share its invite link with the people you want to join. Groups are private, can have up to 50 readers, and use chapter-labelled messages with spoiler protection."],
  ["What should I put in Find Books?", "A few books you liked or didn’t enjoy, the categories that interest you and what matters to you. Mixed interests are welcome. Recommendations can occasionally miss the mark; use the result’s book page to check its details before deciding."],
];
export default function HelpPage() {
  return <><h1>Help</h1><p>A few answers to get you started.</p>
    <div className="mt-6 space-y-3">{questions.map(([question, answer]) => <details key={question} className="rounded-2xl border border-[var(--aepilog-border)] bg-[var(--aepilog-paper)] p-5"><summary className="cursor-pointer font-medium">{question}</summary><p>{answer}</p></details>)}</div>
    <section id="reports" className="scroll-mt-6"><h2>Report a problem or block someone</h2><p>Open the ⋯ menu beside another reader’s post, comment, review or profile. Choose Report and tell us what’s wrong. Reports are only visible to the person who sent them and aepilog’s moderator.</p><p>Blocking hides that reader’s content while you’re signed in and stops direct interactions between your accounts. You can unblock someone in <Link href="/settings">Settings</Link>. Public posts are still visible when signed out.</p></section>
    <h2>Something isn’t working?</h2><p>Check that you’re signed in, then try the page’s retry button. If the problem continues, <Link href="/contact">get in touch</Link>.</p>
  </>;
}
