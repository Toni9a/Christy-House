import { bad } from "@/lib/http";
import { getSetting, setSetting } from "@/lib/store";

const KEY = "house_scan";

export async function GET() {
  return Response.json({ file: await getSetting(KEY) });
}

/** { file }: a .glb already uploaded through /api/uploads. { file: null } removes it. */
export async function PUT(req: Request) {
  const { file } = await req.json();
  if (file === null) { await setSetting(KEY, null); return Response.json({ file: null }); }
  if (typeof file !== "string" || !/^[\w-]+\.(glb|gltf|usdz)$/.test(file)) return bad("Upload a .glb scan first.");
  await setSetting(KEY, file);
  return Response.json({ file });
}
