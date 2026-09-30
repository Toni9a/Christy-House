import { notFound } from "next/navigation";
import { Finder } from "@/components/Finder";
import { config } from "@/lib/config";
import { getSearch, listRooms } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function SearchPage({ params }: { params: Promise<{ id: string }> }) {
  const search = await getSearch((await params).id);
  if (!search) notFound();
  return (
    <Finder rooms={await listRooms()} currency={config.currency} initial={search}
      initialRoomId={search.filters.roomId} geminiEnabled={Boolean(process.env.GEMINI_API_KEY)} />
  );
}
