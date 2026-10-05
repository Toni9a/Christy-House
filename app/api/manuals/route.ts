import { newId } from "@/lib/db/util";
import { bad } from "@/lib/http";
import { getWho } from "@/lib/identity";
import { loadManuals, saveManuals } from "@/lib/manuals";
import { MANUAL_CATEGORIES, MANUAL_FILE_RE, type Fact, type Manual, type ManualFile } from "@/lib/manuals-types";

const cleanFiles = (files: unknown): ManualFile[] =>
  (Array.isArray(files) ? files : [])
    .filter((f): f is ManualFile => typeof f?.file === "string" && MANUAL_FILE_RE.test(f.file))
    .map((f) => ({ file: f.file, name: String(f.name ?? f.file).slice(0, 80) }))
    .slice(0, 12);
const cleanFacts = (facts: unknown): Fact[] =>
  (Array.isArray(facts) ? facts : [])
    .filter((f) => typeof f?.label === "string" && f.label.trim())
    .map((f) => ({ label: String(f.label).trim().slice(0, 60), value: String(f.value ?? "").slice(0, 300), ...(f.secret ? { secret: true } : {}) }))
    .slice(0, 24);
const cleanCategory = (c: unknown) => (MANUAL_CATEGORIES.includes(String(c)) ? String(c) : "Other");

export async function GET() {
  return Response.json(await loadManuals());
}

/** { title, category, notes, facts?: [{ label, value, secret? }], files: [{ file, name }] }: files are already uploaded through /api/uploads. */
export async function POST(req: Request) {
  const b = await req.json();
  const title = String(b.title ?? "").trim().slice(0, 100);
  if (!title) return bad("Give it a title, like “Boiler manual”.");
  const m: Manual = {
    id: newId(), title, category: cleanCategory(b.category), notes: String(b.notes ?? "").slice(0, 4000),
    facts: cleanFacts(b.facts), files: cleanFiles(b.files), addedBy: await getWho(), addedAt: new Date().toISOString(),
  };
  const list = [...(await loadManuals()), m];
  await saveManuals(list);
  return Response.json(list);
}

/** { id, title?, category?, notes?, facts?, files? }: facts and files, when given, replace the whole list. */
export async function PUT(req: Request) {
  const b = await req.json();
  const list = await loadManuals();
  const m = list.find((x) => x.id === b.id);
  if (!m) return bad("Not found", 404);
  if (typeof b.title === "string" && b.title.trim()) m.title = b.title.trim().slice(0, 100);
  if (b.category !== undefined) m.category = cleanCategory(b.category);
  if (typeof b.notes === "string") m.notes = b.notes.slice(0, 4000);
  if (b.facts !== undefined) m.facts = cleanFacts(b.facts);
  if (b.files !== undefined) m.files = cleanFiles(b.files);
  await saveManuals(list);
  return Response.json(list);
}

export async function DELETE(req: Request) {
  const { id } = await req.json();
  const list = (await loadManuals()).filter((x) => x.id !== id);
  await saveManuals(list);
  return Response.json(list);
}
