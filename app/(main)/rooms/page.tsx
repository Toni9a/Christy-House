import { NewRoomForm } from "@/components/NewRoomForm";
import { RoomCard } from "@/components/RoomCard";
import { getRoomCovers } from "@/lib/social";
import { Card, Eyebrow } from "@/components/ui";
import { config } from "@/lib/config";
import { listItems, listRooms } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function RoomsPage() {
  const [rooms, items] = await Promise.all([listRooms(), listItems()]);
  const covers = await getRoomCovers(rooms.map((r) => r.id));
  const total = rooms.reduce((s, r) => s + (r.dims.width && r.dims.depth ? (r.dims.width * r.dims.depth) / 10000 : 0), 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div>
          <Eyebrow>{config.houseName}</Eyebrow>
          <h1 className="font-display text-4xl sm:text-5xl">Rooms</h1>
        </div>
        {total > 0 && <p className="text-sm tabular-nums text-muted">{rooms.length} rooms · {total.toFixed(1)} m² measured</p>}
      </div>

      <Card className="p-4"><NewRoomForm /></Card>

      {rooms.length ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {rooms.map((r) => <RoomCard key={r.id} room={r} items={items.filter((i) => i.roomId === r.id)} cover={covers[r.id]} />)}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-line px-6 py-16 text-center">
          <p className="font-display text-2xl">Start with the room you’re furnishing first</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">Add it above, then upload your LiDAR scan — dimensions fill in automatically, and every search for that room respects them.</p>
        </div>
      )}
    </div>
  );
}
