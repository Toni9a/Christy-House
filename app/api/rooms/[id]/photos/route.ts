import { bad } from "@/lib/http";
import { getWho } from "@/lib/identity";
import { addRoomPhoto, getRoom, listRoomPhotos } from "@/lib/store";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Ctx) {
  return Response.json(await listRoomPhotos((await params).id));
}

/** { files: string[], caption? }: photos already uploaded through /api/uploads. */
export async function POST(req: Request, { params }: Ctx) {
  const roomId = (await params).id;
  if (!(await getRoom(roomId))) return bad("Room not found", 404);
  const { files, caption } = (await req.json()) as { files: string[]; caption?: string };
  const good = (files ?? []).filter((f) => /^[\w-]+\.[a-z0-9]+$/.test(f)).slice(0, 30);
  if (!good.length) return bad("No photos to add.");
  const addedBy = await getWho();
  const out = [];
  for (const file of good) out.push(await addRoomPhoto({ roomId, file, caption: caption ?? "", addedBy }));
  return Response.json(out);
}
