import { config } from "@/lib/config";
import { bad } from "@/lib/http";
import { getWho } from "@/lib/identity";
import { addItem, listItems } from "@/lib/store";
import type { ItemStatus, Product } from "@/lib/types";

const STATUSES: ItemStatus[] = ["idea", "to-buy", "ordered", "have"];
const hostOf = (url: string) => {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
};
const numOrNull = (v: unknown) => (v == null || v === "" || Number.isNaN(Number(v)) ? null : Number(v));

export async function GET(req: Request) {
  const roomId = new URL(req.url).searchParams.get("room");
  return Response.json(await listItems(roomId ?? undefined));
}

/**
 * Two ways in:
 *  - `{ product, roomId }`: saving a search result
 *  - `{ title, imageFile?, url?, price?, … }`: someone adding an idea by hand
 */
export async function POST(req: Request) {
  const body = await req.json();
  const addedBy = await getWho();

  if (body.product) {
    const { product, roomId, status } = body as { product: Product; roomId: string | null; status?: ItemStatus };
    return Response.json(await addItem({ ...product, roomId, status: status ?? "idea", notes: "", addedBy }));
  }

  const title = String(body.title ?? "").trim();
  if (!title) return bad("Give the item a name.");
  const url = String(body.url ?? "").trim();
  const imageFile = String(body.imageFile ?? "");
  return Response.json(await addItem({
    title,
    url,
    source: hostOf(url),
    price: numOrNull(body.price),
    currency: config.currency,
    image_url: /^[\w-]+\.[a-z0-9]+$/.test(imageFile) ? `/api/files/${imageFile}` : null,
    width_cm: numOrNull(body.width_cm),
    depth_cm: numOrNull(body.depth_cm),
    height_cm: numOrNull(body.height_cm),
    condition: "unknown",
    match_score: 0,
    why: "",
    roomId: body.roomId || null,
    status: STATUSES.includes(body.status) ? body.status : "idea",
    notes: String(body.notes ?? ""),
    addedBy,
  }));
}
