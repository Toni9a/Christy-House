import { bad } from "@/lib/http";
import { getWho } from "@/lib/identity";
import { addComment, deleteComment, getItem, listComments } from "@/lib/store";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Ctx) {
  return Response.json(await listComments((await params).id));
}

export async function POST(req: Request, { params }: Ctx) {
  const itemId = (await params).id;
  const author = await getWho();
  if (!author) return bad("Tell us your name first.", 401);
  const body = String((await req.json()).body ?? "").trim().slice(0, 2000);
  if (!body) return bad("Write something first.");
  if (!(await getItem(itemId))) return bad("That item's gone.", 404);
  return Response.json(await addComment({ itemId, author, body }));
}

/** Delete your own comment: DELETE ?comment=<id> */
export async function DELETE(req: Request, { params }: Ctx) {
  const id = new URL(req.url).searchParams.get("comment");
  const who = await getWho();
  const mine = (await listComments((await params).id)).find((c) => c.id === id && c.author === who);
  if (!mine) return bad("You can only delete your own comments.", 403);
  await deleteComment(mine.id);
  return new Response(null, { status: 204 });
}
