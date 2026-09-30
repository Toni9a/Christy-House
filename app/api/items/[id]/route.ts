import { bad } from "@/lib/http";
import { deleteItem, getItem, updateItem } from "@/lib/store";
import type { Item, ItemStatus } from "@/lib/types";

const STATUSES: ItemStatus[] = ["idea", "to-buy", "ordered", "have"];
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Ctx) {
  const item = await getItem((await params).id);
  return item ? Response.json(item) : bad("Not found", 404);
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { status, roomId, notes, price, title, url } = (await req.json()) as Partial<Item>;
  if (status && !STATUSES.includes(status)) return bad("Unknown status");
  const patch = Object.fromEntries(Object.entries({ status, roomId, notes, price, title, url }).filter(([, v]) => v !== undefined));
  const item = await updateItem((await params).id, patch);
  return item ? Response.json(item) : bad("Not found", 404);
}

export async function DELETE(_: Request, { params }: Ctx) {
  await deleteItem((await params).id);
  return new Response(null, { status: 204 });
}
