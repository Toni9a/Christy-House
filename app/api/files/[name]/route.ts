import { streamBlob } from "@/lib/db/postgres";
import { getFile } from "@/lib/store";

const CACHE = "public, max-age=31536000, immutable";

/** Serves uploaded photos and scans. Names are random, so they can't be guessed. */
export async function GET(_: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!/^[\w-]+\.[a-z0-9]+$/.test(name)) return new Response("Not found", { status: 404 });

  // On the real site, stream straight from Blob: scans can be tens of MB.
  const blob = await streamBlob(name);
  if (blob) return new Response(blob.stream, { headers: { "content-type": blob.contentType, "cache-control": CACHE } });
  if (blob === null) return new Response("Not found", { status: 404 });

  const file = await getFile(name);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.data), { headers: { "content-type": file.contentType, "cache-control": CACHE } });
}
