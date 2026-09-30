import { ItemBoard } from "@/components/ItemBoard";
import { Eyebrow } from "@/components/ui";
import { config, money } from "@/lib/config";
import { getSocial } from "@/lib/social";
import { listItems, listRooms } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function ItemsPage() {
  const [items, rooms, social] = await Promise.all([listItems(), listRooms(), getSocial()]);
  const spent = items.filter((i) => i.status === "ordered" || i.status === "have").reduce((s, i) => s + (i.price ?? 0), 0);
  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div>
          <Eyebrow>{config.houseName}</Eyebrow>
          <h1 className="font-display text-4xl sm:text-5xl">Everything, room by room</h1>
        </div>
        {spent > 0 && <p className="text-sm tabular-nums text-muted">{money(spent, config.currency)} bought or ordered</p>}
      </div>
      <ItemBoard items={items} social={social} rooms={rooms} currency={config.currency} />
    </div>
  );
}
