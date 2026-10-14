import type { Metadata } from "next";
import { Manuals } from "@/components/Manuals";
import { MoveIn } from "@/components/MoveIn";
import Link from "next/link";
import { Eyebrow } from "@/components/ui";
import { config } from "@/lib/config";
import { loadFloorPlans } from "@/lib/floor-plans";
import { loadManuals } from "@/lib/manuals";
import { getSetting, listMeterReadings, listPhotosByKind, listRooms } from "@/lib/store";

export const metadata: Metadata = { title: "Move-in · Christy’s House" };
export const dynamic = "force-dynamic";

export default async function MoveInPage() {
  const [rooms, photos, readings, houseScan, floorPlans] = await Promise.all([listRooms(), listPhotosByKind("movein"), listMeterReadings(), getSetting("house_scan"), loadFloorPlans()]);
  const originalScan = await getSetting("house_scan_original");
  const manuals = await loadManuals();
  return (
    <div className="space-y-12">
      <div>
        <Eyebrow>{config.houseName}</Eyebrow>
        <h1 className="font-display text-4xl sm:text-5xl">Move-in day</h1>
        <p className="mt-2 max-w-xl text-sm text-muted">
          The record of how the house was when we got the keys: meter readings, and each room bare. The bare photos are what Gemini starts from when you preview furniture in a room.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/value" className="flex items-center justify-between rounded-2xl border border-line bg-surface px-5 py-4 transition hover:bg-sunken">
          <span><span className="block font-display text-xl">Value</span><span className="text-sm text-muted">What the house is worth, nearby sales and running costs</span></span>
          <span aria-hidden className="text-muted">→</span>
        </Link>
        <Link href="/items" className="flex items-center justify-between rounded-2xl border border-line bg-surface px-5 py-4 transition hover:bg-sunken">
          <span><span className="block font-display text-xl">All items</span><span className="text-sm text-muted">Everything saved for every room</span></span>
          <span aria-hidden className="text-muted">→</span>
        </Link>
      </div>
      <MoveIn afterMeters={<Manuals manuals={manuals} />} rooms={rooms.map((r) => ({ id: r.id, name: r.name }))} photos={photos} readings={readings} houseScan={houseScan} originalScan={originalScan} floorPlans={floorPlans} />
    </div>
  );
}
