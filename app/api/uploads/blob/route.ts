import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { bad } from "@/lib/http";
import { CONTENT_TYPES } from "@/lib/db/util";

/**
 * Hands the browser a short-lived token to upload one file straight to Vercel Blob.
 * Only names made by /api/uploads and known file types are allowed.
 */
export async function POST(req: Request) {
  const body = (await req.json()) as HandleUploadBody;
  try {
    return Response.json(await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        if (!/^[\w-]{12}\.[a-z0-9]+$/.test(pathname)) throw new Error("Bad file name");
        return {
          allowedContentTypes: [...new Set(Object.values(CONTENT_TYPES)), "application/octet-stream", "model/gltf-binary"],
          maximumSizeInBytes: 300 * 1024 * 1024, // LiDAR scans can be big
          addRandomSuffix: false,
        };
      },
    }));
  } catch (e) {
    return bad(e instanceof Error ? e.message : "Upload refused");
  }
}
