import { bad } from "@/lib/http";
import { getSetting, setSetting } from "@/lib/store";

const KEY = "house_scan";
const ORIGINAL_KEY = "house_scan_original";

export async function GET() {
  return Response.json({ file: await getSetting(KEY), original: await getSetting(ORIGINAL_KEY) });
}

/** { file, original? }: a .glb already uploaded through /api/uploads (`file` is what the viewer loads; `original` is an optional full-quality copy to download). { file: null } removes both. */
export async function PUT(req: Request) {
  const { file, original } = await req.json();
  if (file === null) { await setSetting(KEY, null); await setSetting(ORIGINAL_KEY, null); return Response.json({ file: null }); }
  if (typeof file !== "string" || !/^[\w-]+\.(glb|gltf|usdz)$/.test(file)) return bad("Upload a .glb scan first.");
  const good = typeof original === "string" && /^[\w-]+\.(glb|gltf|usdz)$/.test(original) ? original : null;
  await setSetting(KEY, file);
  await setSetting(ORIGINAL_KEY, good);
  return Response.json({ file, original: good });
}
