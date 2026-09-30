import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import { Nav } from "@/components/Nav";
import { config } from "@/lib/config";
import { getWho } from "@/lib/identity";
import { WhoPrompt } from "@/components/People";
import { listItems, listRooms, usingDatabase } from "@/lib/store";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", axes: ["opsz", "SOFT"] });

export const metadata: Metadata = {
  title: config.houseName,
  description: "Every room, everything in it, and a shopping brain that finds things that fit.",
  icons: { icon: "/icon.svg" },
};
export const dynamic = "force-dynamic";
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f1ea" },
    { media: "(prefers-color-scheme: dark)", color: "#141311" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [rooms, items, who] = await Promise.all([listRooms(), listItems(), getWho()]);
  const known = [...new Set(items.map((i) => i.addedBy).filter((n): n is string => Boolean(n)))].slice(0, 8);
  const nav = rooms.map((r) => ({ id: r.id, name: r.name, count: items.filter((i) => i.roomId === r.id).length }));
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`}>
      <body className="min-h-dvh font-sans">
        {process.env.VERCEL && !usingDatabase && (
          <p className="bg-warn-soft px-4 py-2 text-center text-[13px] text-warn">
            Storage isn’t connected yet, so anything added here will disappear. Add Neon and Blob in Vercel → Storage.
          </p>
        )}
        <Nav houseName={config.houseName} rooms={nav} who={who} />
        <WhoPrompt who={who} known={known} />
        <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 sm:px-6 sm:pt-10">{children}</main>
      </body>
    </html>
  );
}
