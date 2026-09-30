import { bad } from "@/lib/http";
import { getWho } from "@/lib/identity";
import { setReaction } from "@/lib/store";

/** { value: "love" | "nope" | null }: one reaction per person per item; null clears it. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const who = await getWho();
  if (!who) return bad("Tell us your name first.", 401);
  const { value } = await req.json();
  if (value !== null && value !== "love" && value !== "nope") return bad("Unknown reaction");
  await setReaction((await params).id, who, value);
  return Response.json({ ok: true });
}
