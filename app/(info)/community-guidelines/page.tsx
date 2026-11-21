import Link from "next/link";
export const metadata = { title: "Community guidelines", description: "Keep aepilog welcoming, protect readers from spoilers and share your own words." };
export default function GuidelinesPage() {
  return <><h1>Community guidelines</h1><p>Strong opinions about books are welcome. Be considerate of the people sharing them.</p>
    <h2>Disagree without making it personal</h2><p>Talk about the book or the idea. Don’t harass, threaten, target someone’s identity or keep contacting them after they’ve asked you to stop.</p>
    <h2>Give spoilers a warning</h2><p>Mark plot reveals and ending discussions as spoilers. Avoid putting a reveal in a poll’s visible book choices. Chapter and Epilogue labels help readers understand the context, but don’t replace the spoiler warning.</p>
    <h2>Share your own words</h2><p>Post your own reactions and recommendations. Don’t copy someone else’s review and present it as yours, share pirated books or upload content you don’t have permission to use. If you reference another discussion, link to it and give credit.</p>
    <h2>Keep personal information private</h2><p>Don’t share anyone’s private messages, email, phone number, account details or other personal information without their permission.</p>
    <h2>Keep it about reading</h2><p>General questions, manga, nonfiction and unpopular opinions belong here too. Spam, scams, deceptive promotions and repeated advertising don’t.</p>
    <h2>When something crosses the line</h2><p>Use the ⋯ menu to report it, or block the reader. aepilog’s moderator can review reports and hide content. <Link href="/help#reports">How reporting and blocking work</Link>.</p>
  </>;
}
