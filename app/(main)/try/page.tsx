import type { Metadata } from "next";
import { TryOn } from "@/components/TryOn";
import { Eyebrow } from "@/components/ui";
import { config } from "@/lib/config";
import { ROOM_PLANS } from "@/lib/room-plans";
import { listItems, listPhotosByKind, listRooms } from "@/lib/store";
import { loadRenders, loadSkipped, loadViews } from "@/lib/tryon/store";

export const metadata: Metadata = { title: "Try furniture · Christy’s House" };
export const dynamic = "force-dynamic";

export default async function TryPage() {
  const [rooms, movein, now, views, renders, items, skipped] = await Promise.all([listRooms(), listPhotosByKind("movein"), listPhotosByKind("now"), loadViews(), loadRenders(), listItems(), loadSkipped()]);
  const ideas = items.flatMap((i) => {
    const file = i.image_url?.match(/^\/api\/files\/([\w-]+\.(?:jpe?g|png|webp))$/i)?.[1];
    return file ? [{ file, title: i.title }] : [];
  });
  return (
    <div className="space-y-8">
      <div>
        <Eyebrow>{config.houseName}</Eyebrow>
        <h1 className="font-display text-4xl sm:text-5xl">Try furniture in the room</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Add a photo of a sofa (or anything else) and see it in our real rooms at its real size. The size and position come from the room’s measured plan, not from the AI: Gemini only draws your exact piece into the space and matches the light.
        </p>
      </div>
      <TryOn rooms={rooms.map((r) => ({ id: r.id, name: r.name }))} plans={ROOM_PLANS} photos={[...movein, ...now].filter((p) => !skipped.includes(p.file))} initialViews={views} initialRenders={renders} ideas={ideas} />
    </div>
  );
}
