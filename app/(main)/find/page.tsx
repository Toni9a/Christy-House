import { Finder } from "@/components/Finder";
import { config } from "@/lib/config";
import { getItem, listRooms } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function FindPage({ searchParams }: { searchParams: Promise<{ room?: string; item?: string }> }) {
  const { room, item: itemId } = await searchParams;
  const [rooms, item] = await Promise.all([listRooms(), itemId ? getItem(itemId) : null]);
  return (
    <Finder rooms={rooms} currency={config.currency} initial={null}
      initialRoomId={room ?? item?.roomId ?? null} geminiEnabled={Boolean(process.env.GEMINI_API_KEY)}
      fromItem={item ? { id: item.id, title: item.title, price: item.price, image_url: item.image_url } : null} />
  );
}
