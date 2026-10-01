import type { Metadata } from "next";
import { MoveIn } from "@/components/MoveIn";
import { Eyebrow } from "@/components/ui";
import { config } from "@/lib/config";
import { loadFloorPlans } from "@/lib/floor-plans";
import { getSetting, listMeterReadings, listPhotosByKind, listRooms } from "@/lib/store";

export const metadata: Metadata = { title: "Move-in · Christy’s House" };
export const dynamic = "force-dynamic";

export default async function MoveInPage() {
  const [rooms, photos, readings, houseScan, floorPlans] = await Promise.all([listRooms(), listPhotosByKind("movein"), listMeterReadings(), getSetting("house_scan"), loadFloorPlans()]);
  return (
    <div className="space-y-12">
      <div>
        <Eyebrow>{config.houseName}</Eyebrow>
        <h1 className="font-display text-4xl sm:text-5xl">Move-in day</h1>
        <p className="mt-2 max-w-xl text-sm text-muted">
          The record of how the house was when we got the keys: meter readings, and each room bare. The bare photos are what Gemini starts from when you preview furniture in a room.
        </p>
      </div>
      <MoveIn rooms={rooms.map((r) => ({ id: r.id, name: r.name }))} photos={photos} readings={readings} houseScan={houseScan} floorPlans={floorPlans} />
    </div>
  );
}
