import type { Metadata } from "next";
import { headers } from "next/headers";
import { connection } from "next/server";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { brand } from "@/config/brand";
import "./globals.css";

export const dynamic = "force-dynamic";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: brand.name, template: `%s · ${brand.name}` },
  description: brand.tagline,
  icons: { icon: "/favicon.svg" },
  openGraph: { title: brand.name, description: brand.tagline, images: ["/og.svg"] },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await connection();
  await headers();
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <body className="min-h-screen antialiased" style={{ fontFamily: "var(--font-geist-sans), var(--font-sans)" }}>
        {children}
      </body>
    </html>
  );
}
