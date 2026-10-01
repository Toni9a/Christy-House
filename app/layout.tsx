import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import { config } from "@/lib/config";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", axes: ["opsz", "SOFT"] });

export const metadata: Metadata = {
  title: config.houseName,
  description: "Every room, everything in it, and a shopping brain that finds things that fit.",
  icons: { icon: "/icon.svg" },
};
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f1ea" },
    { media: "(prefers-color-scheme: dark)", color: "#141311" },
  ],
};

/**
 * The bare shell: fonts and global styles only. The Nav, name prompt and the
 * room-strip header live in (main)/layout.tsx instead, so pages outside that
 * group — /welcome, /join/{code} — never render the room list or ask for a
 * name before someone's actually in the house.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`}>
      <body className="min-h-dvh font-sans">{children}</body>
    </html>
  );
}
