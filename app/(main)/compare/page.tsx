import Link from "next/link";
import { dimsText, STATUS_STYLE } from "@/lib/items";
import { Avatar } from "@/components/People";
import { Eyebrow } from "@/components/ui";
import { config, money } from "@/lib/config";
import { getSocial } from "@/lib/social";
import { getItem, listComments, listRooms } from "@/lib/store";
import { ITEM_STATUSES } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Up to four items side by side: price, size, fit, who loves it, and the latest comment. */
export default async function ComparePage({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  const ids = ((await searchParams).ids ?? "").split(",").filter(Boolean).slice(0, 4);
  const [found, rooms, social] = await Promise.all([Promise.all(ids.map(getItem)), listRooms(), getSocial()]);
  const items = found.filter((i): i is NonNullable<typeof i> => Boolean(i));
  const latest = await Promise.all(items.map(async (i) => (await listComments(i.id)).at(-1) ?? null));
  const priced = items.filter((i) => i.price != null);
  const cheapest = priced.length > 1 ? Math.min(...priced.map((i) => i.price!)) : null;
  const loveCounts = items.map((i) => (social[i.id]?.reactions ?? []).filter((r) => r.value === "love").length);
  const top = Math.max(0, ...loveCounts);
  // Only call one "most loved" when it's a clear winner.
  const mostLovedId = top > 0 && loveCounts.filter((n) => n === top).length === 1 ? items[loveCounts.indexOf(top)].id : null;
  const room = rooms.find((r) => r.id === items[0]?.roomId);

  if (items.length < 2) {
    return (
      <div className="rounded-3xl border border-dashed border-line px-6 py-16 text-center">
        <p className="font-display text-2xl">Pick at least two things to compare</p>
        <p className="mt-2 text-sm text-muted">Open a room, tap <b>Compare</b>, then choose the items.</p>
      </div>
    );
  }

  const rows: { label: string; cell: (i: (typeof items)[number], n: number) => React.ReactNode }[] = [
    { label: "Price", cell: (i) => (
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-display text-2xl tabular-nums">{i.price != null ? money(i.price, i.currency) : "—"}</span>
        {cheapest != null && i.price === cheapest && <span className="rounded-md bg-fit-soft px-2 py-0.5 text-[12px] font-medium text-fit">Cheapest</span>}
      </div>) },
    { label: "Size", cell: (i) => {
      const r = rooms.find((x) => x.id === i.roomId);
      const fits = r?.dims.width && i.width_cm ? i.width_cm <= r.dims.width : null;
      return (
        <div className="space-y-1 text-sm tabular-nums">
          <p>{dimsText(i) ?? <span className="text-faint">Not given</span>}</p>
          {fits === true && <span className="rounded-md bg-fit-soft px-2 py-0.5 text-[12px] font-medium text-fit">Fits</span>}
          {fits === false && <span className="rounded-md bg-warn-soft px-2 py-0.5 text-[12px] font-medium text-warn">Too wide</span>}
        </div>);
    } },
    { label: "Status", cell: (i) => <span className={`rounded-full px-2.5 py-1 text-[12px] font-medium ${STATUS_STYLE[i.status]}`}>{ITEM_STATUSES.find((s) => s.value === i.status)?.label}</span> },
    { label: "Loved by", cell: (i) => {
      const loves = (social[i.id]?.reactions ?? []).filter((r) => r.value === "love");
      return loves.length
        ? <div className="flex flex-wrap items-center gap-1.5 text-sm">{loves.map((l) => <span key={l.person} className="flex items-center gap-1"><Avatar name={l.person} size={20} />{l.person}</span>)}
            {i.id === mostLovedId && <span className="rounded-md bg-accent-soft px-2 py-0.5 text-[12px] font-medium text-accent">Most loved</span>}</div>
        : <span className="text-sm text-faint">No loves yet</span>;
    } },
    { label: "Not for", cell: (i) => {
      const nopes = (social[i.id]?.reactions ?? []).filter((r) => r.value === "nope");
      return nopes.length ? <p className="text-sm">{nopes.map((n) => n.person).join(", ")}</p> : <span className="text-sm text-faint">—</span>;
    } },
    { label: "Latest comment", cell: (_i, n) => latest[n]
      ? <p className="text-sm leading-relaxed"><b className="font-medium">{latest[n]!.author}:</b> <span className="text-muted">{latest[n]!.body}</span></p>
      : <span className="text-sm text-faint">None yet</span> },
    { label: "Added by", cell: (i) => i.addedBy ? <span className="flex items-center gap-1.5 text-sm"><Avatar name={i.addedBy} size={20} />{i.addedBy}</span> : <span className="text-sm text-faint">—</span> },
  ];

  const cols = `9rem repeat(${items.length}, minmax(13rem, 1fr))`;
  return (
    <div className="space-y-6">
      <div>
        <Link href={room ? `/rooms/${room.id}` : "/items"} className="text-sm text-muted hover:text-ink">← {room?.name ?? "All items"}</Link>
        <Eyebrow>{config.houseName}</Eyebrow>
        <h1 className="font-display text-4xl sm:text-5xl">Side by side</h1>
      </div>

      <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        <div className="grid min-w-max gap-x-4" style={{ gridTemplateColumns: cols }}>
          <div />
          {items.map((i) => (
            <Link key={i.id} href={`/items/${i.id}`} className="group mb-2 block">
              <div className="aspect-[4/3] overflow-hidden rounded-2xl bg-sunken">
                {i.image_url
                  ? <img src={i.image_url} alt="" referrerPolicy="no-referrer" className="size-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                  : <div className="grid size-full place-items-center font-display text-5xl text-faint">{i.title[0]}</div>}
              </div>
              <p className="mt-2 line-clamp-2 font-medium leading-snug group-hover:text-accent">{i.title}</p>
              {i.source && <p className="text-[12px] text-muted">{i.source}</p>}
            </Link>
          ))}
          {rows.map((row) => (
            <div key={row.label} className="contents">
              <p className="border-t border-line py-3 text-[12px] font-medium uppercase tracking-wide text-muted">{row.label}</p>
              {items.map((i, n) => <div key={i.id} className="min-w-0 border-t border-line py-3">{row.cell(i, n)}</div>)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
