import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://aepilog.com"),
  title: {
    default: "aepilog",
    template: "%s | aepilog",
  },
  description:
    "Discover books based on your taste, track what you read, rate books, and join reader discussions on aepilog.",
  applicationName: "aepilog",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "aepilog",
    description:
      "Discover books based on your taste, track what you read, rate books, and join reader discussions.",
    url: "https://aepilog.com",
    siteName: "aepilog",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${fraunces.variable}`}>
        {children}
      </body>
    </html>
  );
}
