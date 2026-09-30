import { visualize } from "@/lib/gemini";
import { bad } from "@/lib/http";
import { getFile, storeFile } from "@/lib/store";

export const maxDuration = 120;

const localName = (url: string) => url.match(/^\/api\/files\/([\w-]+\.[a-z0-9]+)$/)?.[1] ?? null;

/** { roomFile, productImage?, description }: Gemini renders the item into the room photo. */
export async function POST(req: Request) {
  if (!process.env.GEMINI_API_KEY) return bad("Add GEMINI_API_KEY to enable room previews.", 501);
  const { roomFile, productImage, description } = await req.json();
  const room = typeof roomFile === "string" ? await getFile(roomFile) : null;
  if (!room) return bad("Upload a photo of the room.");

  let product = null;
  const src = String(productImage ?? "");
  const local = localName(src);
  if (local) {
    const f = await getFile(local);
    if (f) product = { base64: f.data.toString("base64"), mediaType: f.contentType };
  } else if (src.startsWith("http")) {
    const r = await fetch(src).catch(() => null);
    if (r?.ok) product = { base64: Buffer.from(await r.arrayBuffer()).toString("base64"), mediaType: r.headers.get("content-type") || "image/jpeg" };
  }

  try {
    const out = await visualize({ room: { base64: room.data.toString("base64"), mediaType: room.contentType }, product, productDesc: String(description ?? "") });
    const name = await storeFile(Buffer.from(out.base64, "base64"), out.mediaType.split("/")[1] || "png", out.mediaType);
    return Response.json({ url: `/api/files/${name}` });
  } catch (e) {
    return bad(e instanceof Error ? e.message : "Render failed", 502);
  }
}
