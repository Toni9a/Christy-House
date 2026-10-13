import { bad } from "@/lib/http";
import { getFile } from "@/lib/store";
import { analyseItem } from "@/lib/tryon/analyse";
import { FILE_RE } from "@/lib/tryon/store";

export const maxDuration = 60;

/** { file, hint? }: what the furniture is, its size and the details that make it this product. */
export async function POST(req: Request) {
  if (!process.env.GEMINI_API_KEY) return bad("Add GEMINI_API_KEY to use this.", 501);
  const { file, hint } = await req.json();
  if (typeof file !== "string" || !FILE_RE.test(file)) return bad("Add a photo of the furniture.");
  const f = await getFile(file);
  if (!f) return bad("Couldn’t find that photo.", 404);
  try {
    return Response.json(await analyseItem(f.data, String(hint ?? "").slice(0, 300)));
  } catch (e) {
    return bad(e instanceof Error ? e.message : "Couldn’t read that photo.", 502);
  }
}
