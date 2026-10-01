import { bad } from "@/lib/http";
import { getWho } from "@/lib/identity";
import { addMeterReading, listMeterReadings } from "@/lib/store";
import { METER_TYPES, type MeterType } from "@/lib/types";

export async function GET() {
  return Response.json(await listMeterReadings());
}

/** { meter, reading, unit?, label?, photo?, takenOn?, notes? }: photo is a file already uploaded through /api/uploads. */
export async function POST(req: Request) {
  const b = await req.json();
  const meter = METER_TYPES.some((t) => t.value === b.meter) ? (b.meter as MeterType) : "other";
  const reading = String(b.reading ?? "").trim().slice(0, 40);
  if (!reading) return bad("Type the number on the meter.");
  const photo = typeof b.photo === "string" && /^[\w-]+\.[a-z0-9]+$/.test(b.photo) ? b.photo : null;
  const takenOn = /^\d{4}-\d{2}-\d{2}$/.test(b.takenOn ?? "") ? b.takenOn : new Date().toISOString().slice(0, 10);
  const out = await addMeterReading({
    meter, reading, photo, takenOn,
    label: String(b.label ?? "").trim().slice(0, 60),
    unit: String(b.unit ?? "").trim().slice(0, 12),
    notes: String(b.notes ?? "").trim().slice(0, 500),
    addedBy: await getWho(),
  });
  return Response.json(out);
}
