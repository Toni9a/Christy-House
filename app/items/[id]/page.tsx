import { notFound } from "next/navigation";
import { ItemDetail } from "@/components/ItemDetail";
import { config } from "@/lib/config";
import { getWho } from "@/lib/identity";
import { googleEnabled } from "@/lib/lens";
import { getItem, listComments, listReactions, listRooms } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getItem(id);
  if (!item) notFound();
  const [rooms, comments, reactions, who] = await Promise.all([listRooms(), listComments(id), listReactions(), getWho()]);
  return (
    <ItemDetail key={item.id} item={item} rooms={rooms} comments={comments} reactions={reactions.filter((r) => r.itemId === id)}
      who={who} baseUrl={config.baseUrl} googleEnabled={googleEnabled()} />
  );
}
