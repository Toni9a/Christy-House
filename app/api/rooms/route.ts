import { createRoom, listRooms } from "@/lib/store";
import { bad } from "@/lib/http";

export async function GET() {
  return Response.json(await listRooms());
}

export async function POST(req: Request) {
  const body = await req.json();
  if (!body.name?.trim()) return bad("Room needs a name.");
  const room = await createRoom({
    name: body.name.trim(),
    kind: body.kind || "other",
    dims: { width: body.dims?.width ?? null, depth: body.dims?.depth ?? null, height: body.dims?.height ?? null },
    notes: body.notes ?? "",
    scanFile: null,
  });
  return Response.json(room);
}
