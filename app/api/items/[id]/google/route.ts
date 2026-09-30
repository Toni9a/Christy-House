import { geminiEnabled } from "@/lib/gemini";
import { bad } from "@/lib/http";
import { identifySource } from "@/lib/lens";
import { getFile, getItem } from "@/lib/store";

/**
 * "Where is this from?" — Gemini looks at the item's photo, searches the web,
 * and returns what it thinks it is plus pages showing the same thing (often shops selling it).
 */
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!geminiEnabled()) return bad("Add GEMINI_API_KEY to turn this on.", 501);
  const item = await getItem((await params).id);
  if (!item?.image_url) return bad("This item has no photo to check.");

  let data: Buffer | null = null;
  let mediaType = "image/jpeg";
  const local = item.image_url.match(/^\/api\/files\/([\w-]+\.[a-z0-9]+)$/);
  if (local) {
    const file = await getFile(local[1]);
    data = file?.data ?? null;
    if (file?.contentType) mediaType = file.contentType;
  } else {
    const res = await fetch(item.image_url).catch(() => null);
    if (res?.ok) {
      data = Buffer.from(await res.arrayBuffer());
      mediaType = res.headers.get("content-type") || mediaType;
    }
  }
  if (!data) return bad("Couldn't load the photo.", 502);

  try {
    return Response.json(await identifySource(data.toString("base64"), mediaType));
  } catch (e) {
    return bad(e instanceof Error ? e.message : "Check failed", 502);
  }
}
