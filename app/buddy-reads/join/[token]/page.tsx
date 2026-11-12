import { notFound } from "next/navigation";
import { validBuddyId } from "@/lib/buddy-reads";
import JoinBuddyRead from "./JoinBuddyRead";

export const metadata = { title: "Join a buddy read", robots: { index: false, follow: false }, referrer: "no-referrer" as const };
export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!validBuddyId(token)) notFound();
  return <JoinBuddyRead token={token} />;
}
