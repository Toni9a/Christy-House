import Link from "next/link";
import { RoomCard } from "@/components/RoomCard";
import { getRoomCovers } from "@/lib/social";
import { Card } from "@/components/ui";
import { config, money } from "@/lib/config";
import { ScanViewer } from "@/components/ScanViewer";
import { loadManuals } from "@/lib/manuals";
import { getSetting, listItems, listRooms, listSearches } from "@/lib/store";

export const dynamic = "force-dynamic";

const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`;
};

export default async function Home() {
  const [rooms, items, searches, houseScan, originalScan] = await Promise.all([listRooms(), listItems(), listSearches(6), getSetting("house_scan"), getSetting("house_scan_original")]);
  const covers = await getRoomCovers(rooms.map((r) => r.id));
  const manualCount = (await loadManuals()).length;
  const smsOn = Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_FROM_NUMBER);
  const hour = new Date().getHours();
  // Italicise the last word of the house name: "Christy’s *House*".
  const words = config.houseName.split(" ");
  const houseLast = words.pop()!;
  const houseFirst = words.length ? words.join(" ") + " " : "";
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-12">
      {/* Hero: the front of the house */}
      <section className="space-y-4">
        <div className="relative isolate flex min-h-[26rem] items-end overflow-hidden rounded-3xl bg-sunken sm:min-h-[34rem]">
          <img src="/home/front.webp" srcSet="/home/front-sm.webp 1000w, /home/front.webp 2000w" sizes="(min-width: 1152px) 1152px, 100vw"
            alt="The front of Christy’s House: a red-brick semi with a white porch and a bay window, seen from the lawn"
            className="absolute inset-0 -z-10 size-full object-cover object-[center_30%]" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/75 via-black/15 to-transparent sm:bg-gradient-to-tr sm:from-black/75 sm:via-black/20 sm:to-transparent" />
          <div className="p-6 text-white sm:p-10">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/80">{greeting}</p>
            <h1 className="mt-2 font-display text-5xl leading-[1.02] tracking-tight sm:text-7xl">
              {houseFirst}<span className="italic">{houseLast}</span>
            </h1>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/85">
              Every room, everything in it, and everything you’re after. Send a photo or link of anything you like and get real listings at your price, that actually fit.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/find" className="rounded-xl bg-accent px-5 py-3 text-sm font-medium text-accent-ink transition hover:brightness-110">Find something</Link>
              <Link href="/items" className="rounded-xl border border-white/40 bg-white/15 px-5 py-3 text-sm font-medium text-white backdrop-blur transition hover:bg-white/25">All items</Link>
            </div>
          </div>
        </div>

        <Card className="grid grid-cols-3 divide-x divide-line">
          {[
            [rooms.length, "rooms"],
            [items.length, "items"],
            [money(items.filter((i) => i.status === "to-buy").reduce((s, i) => s + (i.price ?? 0), 0), config.currency), "to buy"],
          ].map(([v, l]) => (
            <div key={String(l)} className="px-4 py-5">
              <p className="font-display text-3xl tabular-nums">{v}</p>
              <p className="mt-1 text-xs uppercase tracking-wide text-muted">{l}</p>
            </div>
          ))}
        </Card>
      </section>

      {/* Manuals */}
      <Link href="/movein#manuals" className="-mt-6 flex items-center justify-between gap-4 rounded-2xl border border-line bg-surface px-5 py-4 transition hover:bg-sunken">
        <span>
          <span className="block font-display text-xl">Manuals &amp; how things work</span>
          <span className="text-sm text-muted">{manualCount ? `${manualCount} saved: the boiler, the meters and more` : "The boiler, the meters and anything you might need to change"}</span>
        </span>
        <span aria-hidden className="text-muted">→</span>
      </Link>

      {/* The house in 3D */}
      {houseScan && (
        <section>
          <div className="mb-4 flex items-end justify-between">
            <h2 className="font-display text-2xl">The house in 3D</h2>
            <Link href="/movein" className="text-sm text-muted hover:text-ink">Move-in record →</Link>
          </div>
          <ScanViewer src={`/api/files/${houseScan}`} lazy sizeLabel="12 MB" fallbackHref={`/api/files/${originalScan ?? houseScan}`} />
        </section>
      )}

      {/* Rooms */}
      <section>
        <div className="mb-4 flex items-end justify-between">
          <h2 className="font-display text-2xl">Rooms</h2>
          <Link href="/rooms" className="text-sm text-muted hover:text-ink">Manage rooms →</Link>
        </div>
        {rooms.length ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {rooms.map((r) => <RoomCard key={r.id} room={r} items={items.filter((i) => i.roomId === r.id)} cover={covers[r.id]} />)}
          </div>
        ) : (
          <Link href="/rooms" className="block rounded-3xl border border-dashed border-line px-6 py-10 text-center transition hover:bg-surface">
            <p className="font-display text-xl">Add rooms, then drop in your LiDAR scans</p>
            <p className="mt-1 text-sm text-muted">GLB exports from Polycam or 3D Scanner App measure themselves.</p>
          </Link>
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* Recent searches */}
        <div>
          <h2 className="mb-4 font-display text-2xl">Recent searches</h2>
          {searches.length ? (
            <Card className="divide-y divide-line">
              {searches.map((s) => (
                <Link key={s.id} href={`/find/${s.id}`} className="flex items-center gap-4 p-4 transition hover:bg-sunken/50">
                  <div className="size-12 shrink-0 overflow-hidden rounded-lg bg-sunken">
                    {s.imageFile && <img src={`/api/files/${s.imageFile}`} alt="" className="size-full object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{s.identified?.name || s.query || s.link || "Photo search"}</p>
                    <p className="text-xs text-muted">
                      {s.channel === "sms" ? "via text · " : ""}{ago(s.createdAt)} · {money(s.filters.minPrice)}–{money(s.filters.maxPrice)}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs ${
                    s.status === "done" ? "bg-fit-soft text-fit" : s.status === "error" ? "bg-warn-soft text-warn" : "bg-sunken text-muted"
                  }`}>
                    {s.status === "done" ? `${s.products.length} found` : s.status === "error" ? "failed" : "searching"}
                  </span>
                </Link>
              ))}
            </Card>
          ) : (
            <p className="text-sm text-muted">Nothing yet.</p>
          )}
        </div>

        {/* Texting */}
        <div>
          <h2 className="mb-4 font-display text-2xl">Text it</h2>
          <Card className="p-5">
            {smsOn ? (
              <>
                <p className="text-sm text-muted">Text a photo, a link or a description to</p>
                <p className="mt-1 font-display text-2xl tabular-nums">{process.env.TWILIO_FROM_NUMBER}</p>
              </>
            ) : (
              <p className="text-sm text-muted">Add your Twilio keys to <code className="rounded bg-sunken px-1">.env</code> to search by SMS or WhatsApp.</p>
            )}
            <div className="mt-5 space-y-2 text-sm">
              <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-accent px-3.5 py-2 text-accent-ink">[photo] like this for the living room, under £900, second hand ok</p>
              <p className="w-fit max-w-[85%] rounded-2xl rounded-bl-md bg-sunken px-3.5 py-2">On it 🔎 I’ll text you back in a minute or two.</p>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}
