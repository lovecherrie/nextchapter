import type { Metadata } from "next";
import { Fraunces } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.aepilog.com"),
  verification: { google: "H1OwA9BcZoVaSySdQlWPvCcSLYYpsl62rZR8KW0iXGs" },
  title: { default: "aepilog — Discover books and track your reading", template: "%s | aepilog" },
  description:
    "A book community for discovering, logging, rating, and talking about what you read.",
  openGraph: {
    siteName: "aepilog",
    title: "aepilog — Discover books and track your reading",
    description: "Discover your next book, track your reading, and connect with other readers on aepilog.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={fraunces.variable}>
        {children}
      </body>
    </html>
  );
}
