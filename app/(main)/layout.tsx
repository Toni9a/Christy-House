import { Nav } from "@/components/Nav";
import { WhoPrompt } from "@/components/People";
import { config } from "@/lib/config";
import { getWho } from "@/lib/identity";
import { listItems, listRooms, usingDatabase } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Everything inside the house: the room strip, nav and name prompt, wrapping every page a joined visitor sees. */
export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const [rooms, items, who] = await Promise.all([listRooms(), listItems(), getWho()]);
  const known = [...new Set(items.map((i) => i.addedBy).filter((n): n is string => Boolean(n)))].slice(0, 8);
  const nav = rooms.map((r) => ({ id: r.id, name: r.name, count: items.filter((i) => i.roomId === r.id).length }));
  return (
    <>
      {process.env.VERCEL && !usingDatabase && (
        <p className="bg-warn-soft px-4 py-2 text-center text-[13px] text-warn">
          Storage isn’t connected yet, so anything added here will disappear. Add Neon and Blob in Vercel → Storage.
        </p>
      )}
      <Nav houseName={config.houseName} rooms={nav} who={who} />
      <WhoPrompt who={who} known={known} />
      <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 sm:px-6 sm:pt-10">{children}</main>
    </>
  );
}
