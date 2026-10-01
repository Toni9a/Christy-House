import { deleteMeterReading } from "@/lib/store";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  await deleteMeterReading((await params).id);
  return new Response(null, { status: 204 });
}
