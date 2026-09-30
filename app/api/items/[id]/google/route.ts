import { bad } from "@/lib/http";
import { googleEnabled, visionWeb } from "@/lib/lens";
import { getFile, getItem } from "@/lib/store";

/**
 * "Check with Google": runs the item's photo through Google Cloud Vision's web
 * detection. Returns what Google thinks it is, pages showing the same thing
 * (often shops selling it), and similar-looking images.
 */
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!googleEnabled()) return bad("Add GOOGLE_API_KEY to turn on Google checks.", 501);
  const item = await getItem((await params).id);
  if (!item?.image_url) return bad("This item has no photo to check.");

  let data: Buffer | null = null;
  const local = item.image_url.match(/^\/api\/files\/([\w-]+\.[a-z0-9]+)$/);
  if (local) data = (await getFile(local[1]))?.data ?? null;
  else {
    const res = await fetch(item.image_url).catch(() => null);
    if (res?.ok) data = Buffer.from(await res.arrayBuffer());
  }
  if (!data) return bad("Couldn't load the photo.", 502);

  try {
    return Response.json(await visionWeb(data.toString("base64")));
  } catch (e) {
    return bad(e instanceof Error ? e.message : "Google check failed", 502);
  }
}
