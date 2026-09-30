"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { money } from "@/lib/config";
import { ITEM_STATUSES, type Item, type ItemSocial, type ItemStatus, type Room } from "@/lib/types";
import { AddItemDialog } from "./AddItemDialog";
import { ItemCard } from "./ItemCard";
import { Button } from "./ui";

type Tab = ItemStatus | "all";
const NO_SOCIAL: ItemSocial = { reactions: [], comments: 0 };

/**
 * The items for one room (pass `roomId`) or the whole house (grouped by room).
 * Status tabs across the top, cards below, and a Compare mode to put a few side by side.
 */
export function ItemBoard(props: {
  items: Item[]; social: Record<string, ItemSocial>; rooms: Room[]; roomId?: string | null; currency: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState(props.items);
  const [tab, setTab] = useState<Tab>("all");
  const [adding, setAdding] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const single = props.roomId !== undefined;
  useEffect(() => setItems(props.items), [props.items]);

  const counts = useMemo(() => {
    const c: Record<Tab, number> = { all: items.length, idea: 0, "to-buy": 0, ordered: 0, have: 0 };
    for (const i of items) c[i.status]++;
    return c;
  }, [items]);
  const visible = tab === "all" ? items : items.filter((i) => i.status === tab);
  const toBuy = items.filter((i) => i.status === "to-buy").reduce((s, i) => s + (i.price ?? 0), 0);

  async function change(id: string, patch: Partial<Item>) {
    setItems((list) =>
      list
        .map((i) => (i.id === id ? { ...i, ...patch } : i))
        .filter((i) => !single || patch.roomId === undefined || i.id !== id || i.roomId === props.roomId), // moved out of this room
    );
    await fetch(`/api/items/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(patch) });
    router.refresh();
  }
  async function remove(id: string) {
    setItems((list) => list.filter((i) => i.id !== id));
    await fetch(`/api/items/${id}`, { method: "DELETE" });
    router.refresh();
  }
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id].slice(-4)));

  const groups = single
    ? [{ id: props.roomId ?? null, name: "", items: visible }]
    : [...props.rooms.map((r) => ({ id: r.id as string | null, name: r.name })), { id: null, name: "No room" }]
        .map((g) => ({ ...g, items: visible.filter((i) => i.roomId === g.id) }))
        .filter((g) => g.items.length);

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="-mx-4 flex min-w-0 gap-1 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0" role="tablist">
          {([{ value: "all", label: "All" }, ...ITEM_STATUSES] as { value: Tab; label: string }[]).map((t) => (
            <button key={t.value} role="tab" aria-selected={tab === t.value} onClick={() => setTab(t.value)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] transition ${
                tab === t.value ? "bg-ink text-paper" : "text-muted hover:bg-sunken hover:text-ink"
              }`}>
              {t.label}
              <span className={`tabular-nums ${tab === t.value ? "text-paper/60" : "text-faint"}`}>{counts[t.value]}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {toBuy > 0 && <p className="mr-2 text-[13px] tabular-nums text-muted">To buy: <span className="font-medium text-ink">{money(toBuy, props.currency)}</span></p>}
          {items.length > 1 && (
            <Button variant={selecting ? "primary" : "ghost"} onClick={() => { setSelecting(!selecting); setPicked([]); }} className="shrink-0">
              {selecting ? "Done" : "Compare"}
            </Button>
          )}
          {!selecting && <Button onClick={() => setAdding(true)} className="shrink-0">+ Add idea</Button>}
        </div>
      </div>
      {selecting && <p className="mt-3 text-sm text-muted">Tap up to 4 items to put them side by side.</p>}

      {items.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-line px-6 py-14 text-center">
          <p className="font-display text-2xl">Nothing here yet</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
            Add a photo of something you like for this room, a link to it, or save one from a{" "}
            <Link href={props.roomId ? `/find?room=${props.roomId}` : "/find"} className="text-accent underline underline-offset-2">search</Link>.
          </p>
          <Button onClick={() => setAdding(true)} className="mt-5">+ Add the first idea</Button>
        </div>
      ) : visible.length === 0 ? (
        <p className="mt-8 text-sm text-muted">Nothing marked “{ITEM_STATUSES.find((s) => s.value === tab)?.label}” yet.</p>
      ) : (
        <div className="mt-6 space-y-10">
          {groups.map((g) => (
            <section key={g.id ?? "none"}>
              {!single && (
                <div className="mb-4 flex items-baseline justify-between border-b border-line pb-3">
                  {g.id ? <Link href={`/rooms/${g.id}`} className="font-display text-2xl hover:text-accent">{g.name} →</Link>
                        : <h2 className="font-display text-2xl">{g.name}</h2>}
                  <p className="text-sm tabular-nums text-muted">{g.items.length}</p>
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {g.items.map((i) => (
                  <ItemCard key={i.id} item={i} social={props.social[i.id] ?? NO_SOCIAL} rooms={props.rooms}
                    onChange={(p) => change(i.id, p)} onRemove={() => remove(i.id)}
                    selecting={selecting} selected={picked.includes(i.id)} onSelect={() => toggle(i.id)} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Comparison tray */}
      {selecting && picked.length > 0 && (
        <div className="fixed inset-x-0 bottom-16 z-30 flex justify-center px-4 sm:bottom-6">
          <div className="flex w-full max-w-md items-center gap-3 rounded-2xl border border-line bg-surface p-2.5 pl-4 shadow-[0_12px_40px_-12px_rgb(0_0_0/0.35)]">
            <div className="flex -space-x-2">
              {picked.map((id) => { const it = items.find((i) => i.id === id); return it?.image_url
                ? <img key={id} src={it.image_url} alt="" className="size-9 rounded-lg object-cover ring-2 ring-surface" />
                : <span key={id} className="grid size-9 place-items-center rounded-lg bg-sunken font-display ring-2 ring-surface">{it?.title[0]}</span>; })}
            </div>
            <p className="flex-1 text-sm text-muted">{picked.length === 1 ? "Pick at least one more" : `${picked.length} picked`}</p>
            <Link href={picked.length > 1 ? `/compare?ids=${picked.join(",")}` : "#"} aria-disabled={picked.length < 2}
              className={`rounded-xl px-4 py-2.5 text-sm font-medium ${picked.length > 1 ? "bg-accent text-accent-ink" : "pointer-events-none bg-sunken text-faint"}`}>
              Compare →
            </Link>
          </div>
        </div>
      )}

      <AddItemDialog open={adding} onClose={() => setAdding(false)} rooms={props.rooms} roomId={props.roomId ?? null}
        currency={props.currency} defaultStatus={tab === "all" ? "idea" : tab}
        onAdded={(it) => {
          if (!single || it.roomId === props.roomId) setItems((l) => [it, ...l]);
          if (tab !== "all" && tab !== it.status) setTab("all");
          router.refresh();
        }} />
    </div>
  );
}
