import Link from "next/link";
export const metadata = { title: "Contact", description: "Get help with aepilog, report a problem or share feedback." };
export default function ContactPage() {
  return <><h1>Contact</h1><p>Need a hand with aepilog?</p>
    <h2>A post or reader needs attention</h2><p>Use the ⋯ menu on the post, comment, review or reader profile and choose Report. That sends a private report to aepilog’s moderator, with the content attached so it can be reviewed.</p><p><Link href="/help#reports">How to report or block someone</Link></p>
    <h2>Help using the website</h2><p>The <Link href="/help">Help page</Link> covers profiles, spoilers, reviews, recommendations and reading circles.</p>
    <h2>Ideas and feedback</h2><p>You can start a general discussion in <Link href="/">Community</Link> without choosing a book. Community posts are public, so please don’t include private account details, your email or passwords.</p>
  </>;
}
