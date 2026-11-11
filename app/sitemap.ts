import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  // Stable public entry points only; private profiles and personal lists stay out.
  return ["", "/find-books", "/readers"].map((path) => ({
    url: `https://www.aepilog.com${path || "/"}`,
  }));
}
