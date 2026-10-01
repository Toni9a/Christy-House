import { bad } from "@/lib/http";
import { getWho } from "@/lib/identity";
import { addRoomPhoto, getRoom, listRoomPhotos } from "@/lib/store";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const kind = new URL(req.url).searchParams.get("kind");
  return Response.json(await listRoomPhotos((await params).id, kind === "movein" || kind === "now" ? kind : undefined));
}

/** { files: string[], caption?, kind?: "now" | "movein" }: photos already uploaded through /api/uploads. */
export async function POST(req: Request, { params }: Ctx) {
  const roomId = (await params).id;
  if (!(await getRoom(roomId))) return bad("Room not found", 404);
  const { files, caption, kind } = (await req.json()) as { files: string[]; caption?: string; kind?: string };
  const good = (files ?? []).filter((f) => /^[\w-]+\.[a-z0-9]+$/.test(f)).slice(0, 30);
  if (!good.length) return bad("No photos to add.");
  const addedBy = await getWho();
  const out = [];
  for (const file of good) out.push(await addRoomPhoto({ roomId, file, caption: caption ?? "", kind: kind === "movein" ? "movein" : "now", addedBy }));
  return Response.json(out);
}
