import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/auth", "/profile", "/settings"] },
    sitemap: "https://www.aepilog.com/sitemap.xml",
  };
}
