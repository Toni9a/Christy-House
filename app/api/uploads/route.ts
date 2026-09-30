import { bad } from "@/lib/http";
import { fileName } from "@/lib/db/util";
import { directUploads } from "@/lib/store";

const ALLOWED = ["jpg", "jpeg", "png", "webp", "gif", "heic", "glb", "gltf", "usdz", "obj"];

/**
 * Step 1 of an upload: reserve a random file name and say where to send it.
 * On the real site that's Vercel Blob directly, so big files (LiDAR scans)
 * never hit the app's 4.5 MB request limit. Locally it's back to the app.
 */
export async function POST(req: Request) {
  const { ext } = (await req.json()) as { ext?: string };
  const e = String(ext ?? "").toLowerCase().replace(/^\./, "");
  if (!ALLOWED.includes(e)) return bad(`Can't upload .${e} files.`);
  const name = fileName(e);
  return Response.json(directUploads
    ? { name, mode: "blob", access: process.env.BLOB_ACCESS === "public" ? "public" : "private" }
    : { name, mode: "local", uploadUrl: `/api/uploads/${name}` });
}
