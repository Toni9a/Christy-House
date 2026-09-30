import crypto from "crypto";

export const newId = () => crypto.randomBytes(6).toString("base64url");

/** A fresh, unguessable file name that keeps the extension. */
export const fileName = (ext: string) => `${crypto.randomBytes(9).toString("base64url")}.${ext.replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin"}`;

export const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", heic: "image/heic",
  glb: "model/gltf-binary", gltf: "model/gltf+json", usdz: "model/vnd.usdz+zip", obj: "text/plain",
};
export const contentTypeOf = (name: string) => CONTENT_TYPES[name.split(".").pop()!.toLowerCase()] ?? "application/octet-stream";

export const STARTER_ROOMS = [
  { id: "living", name: "Living room", kind: "living" },
  { id: "kitchen", name: "Kitchen", kind: "kitchen" },
  { id: "bedroom1", name: "Bedroom 1", kind: "bedroom" },
  { id: "bedroom2", name: "Bedroom 2", kind: "bedroom" },
];
