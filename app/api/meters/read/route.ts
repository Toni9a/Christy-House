import { geminiEnabled } from "@/lib/gemini";
import { bad } from "@/lib/http";
import { readMeter } from "@/lib/meter-ocr";
import { getFile } from "@/lib/store";

export const maxDuration = 60;

/** { file }: a meter photo already uploaded through /api/uploads. Returns Gemini's best reading, for a person to confirm. */
export async function POST(req: Request) {
  if (!geminiEnabled()) return bad("Add GEMINI_API_KEY to read meters from photos.", 501);
  const { file } = await req.json();
  if (typeof file !== "string" || !/^[\w-]+\.[a-z0-9]+$/.test(file)) return bad("Upload a photo of the meter first.");
  const f = await getFile(file);
  if (!f) return bad("Couldn't find that photo.", 404);
  try {
    return Response.json(await readMeter(f.data.toString("base64"), f.contentType));
  } catch (e) {
    return bad(e instanceof Error ? e.message : "Couldn't read the meter", 502);
  }
}
