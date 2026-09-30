import { writeLocalUpload } from "@/lib/db/json";
import { bad } from "@/lib/http";
import { directUploads } from "@/lib/store";

/** Step 2 when running locally (no Supabase): receive the file's bytes. */
export async function PUT(req: Request, { params }: { params: Promise<{ name: string }> }) {
  if (directUploads) return bad("Uploads go straight to storage on this site.", 404);
  const { name } = await params;
  if (!/^[\w-]+\.[a-z0-9]+$/.test(name)) return bad("Bad file name");
  const form = await req.formData();
  const file = [...form.values()].find((v): v is File => v instanceof File);
  if (!file) return bad("No file");
  await writeLocalUpload(name, Buffer.from(await file.arrayBuffer()));
  return Response.json({ name });
}
