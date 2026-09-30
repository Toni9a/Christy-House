import { deleteRoomPhoto } from "@/lib/store";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  await deleteRoomPhoto((await params).id);
  return new Response(null, { status: 204 });
}
