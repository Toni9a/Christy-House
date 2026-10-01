import { listPhotosByKind } from "@/lib/store";

/** GET /api/photos?kind=movein: every photo of that kind, all rooms (used to pick a base photo for previews). */
export async function GET(req: Request) {
  const kind = new URL(req.url).searchParams.get("kind");
  return Response.json(await listPhotosByKind(kind === "now" ? "now" : "movein"));
}
