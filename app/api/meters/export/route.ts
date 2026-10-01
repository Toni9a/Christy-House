import { listMeterReadings } from "@/lib/store";

const cell = (v: string) => `"${v.replace(/"/g, '""')}"`;

/** All readings as a CSV, for keeping your own copy (e.g. to send a supplier or landlord). */
export async function GET() {
  const rows = (await listMeterReadings()).slice().sort((a, b) => a.takenOn.localeCompare(b.takenOn));
  const csv = [
    "date,meter,label,reading,unit,notes,added_by,photo",
    ...rows.map((m) => [m.takenOn, m.meter, cell(m.label), m.reading, cell(m.unit), cell(m.notes), cell(m.addedBy ?? ""), m.photo ? `/api/files/${m.photo}` : ""].join(",")),
  ].join("\n");
  return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="meter-readings.csv"' } });
}
