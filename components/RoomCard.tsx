import Link from "next/link";
import type { Item, Room } from "@/lib/types";
import { FloorPlan } from "./FloorPlan";

/** Cover: a photo of the room if there is one, else a collage of its items, else its floor plan. */
export function RoomCard({ room, items, cover }: { room: Room; items: Item[]; cover?: string | null }) {
  const pics = items.filter((i) => i.image_url).slice(0, 4);
  const have = items.filter((i) => i.status === "have").length;
  const { width, depth } = room.dims;
  const area = width && depth ? (width * depth) / 10000 : null;

  return (
    <Link href={`/rooms/${room.id}`} className="group block rounded-2xl border border-line bg-surface p-3 transition hover:-translate-y-0.5 hover:shadow-[0_8px_30px_-12px_rgb(0_0_0/0.18)]">
      {cover ? (
        <div className="relative aspect-square overflow-hidden rounded-xl bg-sunken">
          <img src={cover} alt="" className="size-full object-cover" />
          {pics.length > 0 && (
            <div className="absolute bottom-2 right-2 flex -space-x-2">
              {pics.slice(0, 3).map((p) => <img key={p.id} src={p.image_url!} alt="" referrerPolicy="no-referrer" className="size-9 rounded-lg object-cover ring-2 ring-surface" />)}
            </div>
          )}
        </div>
      ) : pics.length ? (
        <div className={`grid aspect-square gap-1 overflow-hidden rounded-xl bg-sunken ${pics.length > 1 ? "grid-cols-2" : ""}`}>
          {pics.map((p, i) => (
            <img key={p.id} src={p.image_url!} alt="" referrerPolicy="no-referrer"
              className={`size-full object-cover ${pics.length === 3 && i === 0 ? "row-span-2" : ""}`} />
          ))}
        </div>
      ) : (
        <FloorPlan dims={room.dims} className="aspect-square w-full" />
      )}
      <div className="px-1 pb-1 pt-3">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-display text-lg leading-tight group-hover:text-accent">{room.name}</h3>
          {area && <span className="text-xs tabular-nums text-muted">{area.toFixed(1)} m²</span>}
        </div>
        <p className="mt-1 text-xs text-muted">
          {items.length ? `${items.length} item${items.length === 1 ? "" : "s"}${have ? ` · ${have} in place` : ""}` : "No items yet"}
          {room.scanFile ? " · 3D scan" : ""}
        </p>
      </div>
    </Link>
  );
}
