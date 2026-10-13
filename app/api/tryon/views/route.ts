import { newId } from "@/lib/db/util";
import { bad } from "@/lib/http";
import { getWho } from "@/lib/identity";
import { ROOM_PLANS } from "@/lib/room-plans";
import { getFile } from "@/lib/store";
import { calibratePhoto } from "@/lib/tryon/calibrate";
import { FILE_RE, loadViews, saveViews } from "@/lib/tryon/store";

export const maxDuration = 120;

export async function GET() {
  return Response.json(await loadViews());
}

/** { roomId, file }: fits the photo's camera to the room's measured plan and saves it as a view to try furniture in. */
export async function POST(req: Request) {
  if (!process.env.GEMINI_API_KEY) return bad("Add GEMINI_API_KEY to use this.", 501);
  const { roomId, file } = await req.json();
  const plan = ROOM_PLANS[String(roomId)];
  if (!plan) return bad("That room has no measured plan yet, so its photos can’t be measured.");
  if (typeof file !== "string" || !FILE_RE.test(file)) return bad("Pick a photo of the room.");
  const photo = await getFile(file);
  if (!photo) return bad("Couldn’t find that photo.", 404);
  try {
    const c = await calibratePhoto(photo.data, plan);
    if (c.rmsPct > 2.5) return bad("Couldn’t line this photo up with the room’s plan. Try a wider photo that shows two walls, the floor and the ceiling.", 422);
    const view = { id: newId(), roomId: String(roomId), file, cam: c.cam, rmsPct: +c.rmsPct.toFixed(2), addedBy: await getWho(), addedAt: new Date().toISOString() };
    const views = (await loadViews()).filter((v) => v.file !== file);
    await saveViews([...views, view]);
    return Response.json(view);
  } catch (e) {
    return bad(e instanceof Error ? e.message : "Couldn’t measure that photo.", 422);
  }
}

/** ?id=: forget a view (the photo itself stays). */
export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  await saveViews((await loadViews()).filter((v) => v.id !== id));
  return Response.json({ ok: true });
}
