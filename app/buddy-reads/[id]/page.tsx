import { notFound } from "next/navigation";
import { validBuddyId } from "@/lib/buddy-reads";
import BuddyReadScreen from "./BuddyReadScreen";

export const metadata = { title: "Buddy read", robots: { index: false, follow: false }, referrer: "no-referrer" as const };
export default async function BuddyReadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!validBuddyId(id)) notFound();
  return <BuddyReadScreen key={id} id={id} />;
}
