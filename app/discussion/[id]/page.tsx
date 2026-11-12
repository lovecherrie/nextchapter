import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CommunityScreen from "../../components/CommunityScreen";
import { discussionHref, validDiscussionId } from "@/lib/discussion-links";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const title = "Book discussion | aepilog";
  const description = "Read this book discussion and its replies on aepilog.";
  return { title: "Discussion", description, alternates: { canonical: discussionHref(id) },
    openGraph: { title, description, url: discussionHref(id), siteName: "aepilog", type: "website", images: [{ url: "/brand/aepilog-logo.png", width: 1024, height: 1024, alt: "aepilog cherry logo" }] },
    twitter: { card: "summary", title, description, images: ["/brand/aepilog-logo.png"] },
  };
}

export default async function DiscussionPage({ params }: Props) {
  const { id } = await params;
  if (!validDiscussionId(id)) notFound();
  return <CommunityScreen key={id} discussionId={id} />;
}
