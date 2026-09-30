"use client";
import { upload } from "@vercel/blob/client";

/**
 * Upload a file from the browser and get back its stored name.
 * Photos are shrunk first: phone photos are 5–10 MB and 2000px JPEGs are
 * plenty, which keeps the site quick for everyone. Scans upload as they are.
 */
export async function uploadFile(file: File): Promise<string> {
  const isPhoto = file.type.startsWith("image/") && !/heic|gif/.test(file.type);
  const body = isPhoto ? await shrink(file) : file;
  const ext = isPhoto ? "jpg" : (file.name.split(".").pop() || "bin").toLowerCase();

  const res = await fetch("/api/uploads", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ext }) });
  const slot = await res.json();
  if (!res.ok) throw new Error(slot.error || "Upload failed");

  if (slot.mode === "blob") {
    await upload(slot.name, body, {
      access: slot.access,
      handleUploadUrl: "/api/uploads/blob",
      contentType: isPhoto ? "image/jpeg" : contentTypeFor(ext),
      multipart: body.size > 20 * 1024 * 1024,
    });
  } else {
    const form = new FormData();
    form.append("file", body, `upload.${ext}`);
    const put = await fetch(slot.uploadUrl, { method: "PUT", body: form });
    if (!put.ok) throw new Error("Upload failed. Try again, or try a smaller file.");
  }
  return slot.name as string;
}

const contentTypeFor = (ext: string) =>
  ({ glb: "model/gltf-binary", gltf: "model/gltf+json", usdz: "model/vnd.usdz+zip", png: "image/png", gif: "image/gif", heic: "image/heic" })[ext] ?? "application/octet-stream";

async function shrink(file: File, max = 2000): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    return await new Promise((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error("Couldn't read that photo"))), "image/jpeg", 0.85));
  } catch {
    return file; // unusual format: send it as it is
  }
}

export const fileUrl = (name: string) => `/api/files/${name}`;
