import { getFile } from "@/lib/store";

/** Serves uploaded photos and scans. Names are random, so they can't be guessed. */
export async function GET(_: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!/^[\w-]+\.[a-z0-9]+$/.test(name)) return new Response("Not found", { status: 404 });
  const file = await getFile(name);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.data), {
    headers: { "content-type": file.contentType, "cache-control": "public, max-age=31536000, immutable" },
  });
}
