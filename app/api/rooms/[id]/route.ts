import { deleteRoom, updateRoom } from "@/lib/store";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const { name, kind, dims, notes, scanFile } = await req.json();
  if (scanFile !== undefined && scanFile !== null && !/^[\w-]+\.(glb|gltf|usdz|obj)$/.test(scanFile)) {
    return Response.json({ error: "Upload a GLB, glTF, USDZ or OBJ scan." }, { status: 400 });
  }
  const room = await updateRoom((await params).id, Object.fromEntries(
    Object.entries({ name, kind, dims, notes, scanFile }).filter(([, v]) => v !== undefined),
  ));
  return room ? Response.json(room) : Response.json({ error: "Not found" }, { status: 404 });
}

export async function DELETE(_: Request, { params }: Ctx) {
  await deleteRoom((await params).id);
  return new Response(null, { status: 204 });
}
