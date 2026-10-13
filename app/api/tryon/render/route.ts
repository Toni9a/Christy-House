import { newId } from "@/lib/db/util";
import { bad } from "@/lib/http";
import { getWho } from "@/lib/identity";
import { getFile, storeFile } from "@/lib/store";
import { renderTryOn } from "@/lib/tryon/render";
import { addRender, FILE_RE, loadRenders, loadViews, saveRenders } from "@/lib/tryon/store";
import type { ItemSpec } from "@/lib/tryon/types";
import type { Placement, Shape } from "@/lib/tryon/massing";

export const maxDuration = 300;

const SHAPES: Shape[] = ["straight", "corner-left", "corner-right", "chaise-left", "chaise-right", "box"];
const cm = (v: unknown, lo: number, hi: number) => { const n = Number(v); return n >= lo && n <= hi ? n : null; };
const text = (v: unknown, max: number) => String(v ?? "").slice(0, max);

function cleanSpec(s: any): ItemSpec | string {
  const widthCm = cm(s?.widthCm, 20, 600), depthCm = cm(s?.depthCm, 20, 600), heightCm = cm(s?.heightCm, 10, 300);
  if (!widthCm || !depthCm || !heightCm) return "Check the width, depth and height (in cm).";
  return {
    category: text(s.category, 60) || "sofa", widthCm, depthCm, heightCm,
    dimsSource: s.dimsSource === "printed" || s.dimsSource === "typed" ? s.dimsSource : "estimated",
    shape: SHAPES.includes(s.shape) ? s.shape : "straight",
    seatDepthCm: cm(s.seatDepthCm, 30, 300) ?? undefined, returnWidthCm: cm(s.returnWidthCm, 30, 300) ?? undefined,
    layout: text(s.layout, 300), identity: (Array.isArray(s.identity) ? s.identity : []).map((x: unknown) => text(x, 200)).slice(0, 16),
    leaveOut: text(s.leaveOut, 300) || "none", mechanisms: text(s.mechanisms, 200) || "none", notes: text(s.notes, 400),
  };
}

export async function GET() {
  return Response.json(await loadRenders());
}

/** { viewId, itemFile, title?, spec, placement: {x, y, rot} }: draws the item into the room photo at its real size. */
export async function POST(req: Request) {
  if (!process.env.GEMINI_API_KEY) return bad("Add GEMINI_API_KEY to use this.", 501);
  const b = await req.json();
  const view = (await loadViews()).find((v) => v.id === b.viewId);
  if (!view) return bad("Pick a room photo.");
  if (typeof b.itemFile !== "string" || !FILE_RE.test(b.itemFile)) return bad("Add a photo of the furniture.");
  const spec = cleanSpec(b.spec);
  if (typeof spec === "string") return bad(spec);
  const p = b.placement ?? {};
  const placement: Placement = { x: Number(p.x) || 0, y: Number(p.y) || 0, rot: Number(p.rot) || 0 };
  const [room, product] = await Promise.all([getFile(view.file), getFile(b.itemFile)]);
  if (!room || !product) return bad("Couldn’t find one of the photos.", 404);
  try {
    const out = await renderTryOn({ room: room.data, cam: view.cam, product: product.data, spec, placement });
    const [result, plate, guide] = await Promise.all([storeFile(out.result, "jpg", "image/jpeg"), storeFile(out.plate, "jpg", "image/jpeg"), storeFile(out.guide, "jpg", "image/jpeg")]);
    const r = {
      id: newId(), viewId: view.id, roomId: view.roomId, itemFile: b.itemFile, title: text(b.title, 100) || spec.category,
      spec, placement, result, plate, guide, checks: out.checks, addedBy: await getWho(), addedAt: new Date().toISOString(),
    };
    await addRender(r);
    return Response.json(r);
  } catch (e) {
    return bad(e instanceof Error ? e.message : "Couldn’t draw it. Try again.", 502);
  }
}

/** ?id=: remove a render from the list. */
export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  await saveRenders((await loadRenders()).filter((r) => r.id !== id));
  return Response.json({ ok: true });
}
