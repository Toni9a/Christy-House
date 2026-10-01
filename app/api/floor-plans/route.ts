import { bad } from "@/lib/http";
import { FLOOR_PLANS_KEY as KEY, loadFloorPlans } from "@/lib/floor-plans";
import { setSetting } from "@/lib/store";

export async function GET() {
  return Response.json(await loadFloorPlans());
}

/** { file, label }: an image already uploaded through /api/uploads. */
export async function POST(req: Request) {
  const { file, label } = await req.json();
  if (typeof file !== "string" || !/^[\w-]+\.(jpg|jpeg|png|webp)$/.test(file)) return bad("Upload a floor plan image first.");
  const plans = [...(await loadFloorPlans()), { file, label: String(label ?? "").trim().slice(0, 60) || "Floor plan" }];
  await setSetting(KEY, JSON.stringify(plans));
  return Response.json(plans);
}

/** { file }: remove one. */
export async function DELETE(req: Request) {
  const { file } = await req.json();
  const plans = (await loadFloorPlans()).filter((p) => p.file !== file);
  await setSetting(KEY, JSON.stringify(plans));
  return Response.json(plans);
}
