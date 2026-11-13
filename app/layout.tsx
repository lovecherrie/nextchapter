import type { Metadata } from "next";
import { Fraunces } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { BackHistory } from "./components/BackLink";
import { NotificationsProvider } from "./components/Notifications";
import ClickFeedback from "./components/ClickFeedback";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

const loraNumbers = localFont({
  src: "./fonts/lora-numbers.woff2",
  weight: "400 700",
  variable: "--font-numbers",
  display: "swap",
  adjustFontFallback: false,
  declarations: [{ prop: "unicode-range", value: "U+0030-0039" }],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.aepilog.com"),
  icons: { shortcut: "/icon.png?v=cherry-clean-20261113" },
  verification: { google: "H1OwA9BcZoVaSySdQlWPvCcSLYYpsl62rZR8KW0iXGs" },
  title: { default: "aepilog — Discover books and track your reading", template: "%s | aepilog" },
  description:
    "A book community for discovering, logging, rating, and talking about what you read.",
  openGraph: {
    siteName: "aepilog",
    title: "aepilog — Discover books and track your reading",
    description: "Discover your next book, track your reading, and connect with other readers on aepilog.",
    type: "website",
    images: [{ url: "/brand/aepilog-logo.png", width: 1024, height: 1024, alt: "aepilog cherry logo" }],
  },
  twitter: {
    card: "summary",
    title: "aepilog",
    description: "Discover books and talk about what you read.",
    images: [{ url: "/brand/aepilog-logo.png", alt: "aepilog cherry logo" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${fraunces.variable} ${loraNumbers.variable}`}>
        <BackHistory />
        <ClickFeedback />
        <NotificationsProvider>{children}</NotificationsProvider>
      </body>
    </html>
  );
}
