import Link from "next/link";
import { notFound } from "next/navigation";
import { ItemBoard } from "@/components/ItemBoard";
import { RoomEditor } from "@/components/RoomEditor";
import { RoomPhotos } from "@/components/RoomPhotos";
import { Eyebrow } from "@/components/ui";
import { config } from "@/lib/config";
import { getSocial } from "@/lib/social";
import { getRoom, listItems, listRoomPhotos, listRooms } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const room = await getRoom(id);
  if (!room) notFound();
  const [items, rooms, photos, social] = await Promise.all([listItems(id), listRooms(), listRoomPhotos(id, "now"), getSocial()]);
  const { width, depth, height } = room.dims;

  return (
    <div className="space-y-12">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <Eyebrow>{config.houseName}</Eyebrow>
          <h1 className="font-display text-4xl sm:text-5xl">{room.name}</h1>
          <p className="mt-2 text-sm tabular-nums text-muted">
            {width && depth ? `${Math.round(width)} × ${Math.round(depth)} cm${height ? ` · ${Math.round(height)} cm ceiling` : ""}` : "Not measured yet"}
          </p>
        </div>
        <Link href={`/find?room=${room.id}`} className="rounded-xl border border-line bg-surface px-5 py-3 text-center text-sm font-medium transition hover:bg-sunken">
          Find something for this room
        </Link>
      </div>

      <RoomPhotos key={`p-${room.id}`} roomId={room.id} roomName={room.name} photos={photos} />

      <section>
        <div className="mb-4">
          <h2 className="font-display text-2xl">Ideas & things</h2>
          <p className="text-sm text-muted">Anything you’re thinking of for this room. Tap one to see it big, love it, or comment.</p>
        </div>
        <ItemBoard key={room.id} items={items} social={social} rooms={rooms} roomId={room.id} currency={config.currency} />
      </section>

      <section>
        <div className="mb-4">
          <Eyebrow>Room details</Eyebrow>
          <h2 className="font-display text-2xl">Measurements & 3D scan</h2>
        </div>
        <RoomEditor key={room.id} room={room} />
      </section>
    </div>
  );
}
