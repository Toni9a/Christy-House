import { getSearch } from "@/lib/store";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const search = await getSearch((await params).id);
  return search ? Response.json(search) : Response.json({ error: "Not found" }, { status: 404 });
}
