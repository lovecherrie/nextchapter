import type { ReactNode } from "react";

export const metadata = { title: "Buddy reads", robots: { index: false, follow: false }, referrer: "no-referrer" as const };
export default function BuddyReadsLayout({ children }: { children: ReactNode }) { return children; }
