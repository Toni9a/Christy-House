import { after } from "next/server";
import { config } from "@/lib/config";
import { bad } from "@/lib/http";
import { defaultFilters, startSearch } from "@/lib/run-search";
import { getFile, getItem } from "@/lib/store";
import type { Filters } from "@/lib/types";

export const maxDuration = 300;

const localName = (url: string | null | undefined) => url?.match(/^\/api\/files\/([\w-]+\.[a-z0-9]+)$/)?.[1] ?? null;

/**
 * Start a product search. The reference photo is either one just uploaded
 * (`imageFile`) or the photo of an existing item (`itemId`, for "find it cheaper").
 */
export async function POST(req: Request) {
  const body = await req.json();
  const query = String(body.query ?? "").trim();
  const link = String(body.link ?? "").trim() || null;
  const filters: Filters = { ...defaultFilters(), ...(body.filters ?? {}) };

  let imageFile: string | null = /^[\w-]+\.[a-z0-9]+$/.test(body.imageFile ?? "") ? body.imageFile : null;
  let external: string | null = null;
  if (!imageFile && body.itemId) {
    const item = await getItem(String(body.itemId));
    imageFile = localName(item?.image_url);
    if (!imageFile && item?.image_url?.startsWith("http")) external = item.image_url;
  }

  let image = null;
  if (imageFile) {
    const f = await getFile(imageFile);
    if (!f) return bad("Couldn't find that photo. Try adding it again.");
    image = { base64: f.data.toString("base64"), mediaType: f.contentType, publicUrl: `${config.baseUrl}/api/files/${imageFile}` };
  } else if (external) {
    const r = await fetch(external).catch(() => null);
    if (r?.ok) image = { base64: Buffer.from(await r.arrayBuffer()).toString("base64"), mediaType: r.headers.get("content-type") || "image/jpeg", publicUrl: external };
  }
  if (!query && !link && !image) return bad("Give me a photo, a link, or a description.");

  const { search, run } = await startSearch({ channel: "web", query, link, image, imageFile, filters });
  after(run); // keep working after we respond; the page polls for results
  return Response.json({ id: search.id });
}
