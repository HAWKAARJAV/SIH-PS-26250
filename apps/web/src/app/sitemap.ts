import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl.replace(/\/$/, "");
  return [
    { url: `${base}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${base}/login`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/docs`, changeFrequency: "monthly", priority: 0.6 },
  ];
}
