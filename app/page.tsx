import CommunityPage from "./community/page";

export const metadata = { alternates: { canonical: "https://www.aepilog.com/" } };

export default function HomePage() {
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
      "@context": "https://schema.org", "@type": "WebSite", name: "aepilog", alternateName: "Aepilog", url: "https://www.aepilog.com/",
    }) }} />
    <CommunityPage />
  </>;
}
