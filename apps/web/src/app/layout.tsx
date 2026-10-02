import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { brand } from "@/config/brand";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("http://localhost:3000"),
  title: { default: brand.name, template: `%s · ${brand.name}` },
  description: brand.tagline,
  icons: { icon: "/favicon.svg" },
  openGraph: { title: brand.name, description: brand.tagline, images: ["/og.svg"] },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-screen antialiased" style={{ fontFamily: "var(--font-geist-sans), var(--font-sans)" }}>
        {children}
      </body>
    </html>
  );
}
