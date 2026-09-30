import "server-only";
import { cookies } from "next/headers";

/** Everyone types their name once; it's remembered in a cookie and shown on their photos and comments. */
export const WHO_COOKIE = "who";

export async function getWho(): Promise<string | null> {
  const raw = (await cookies()).get(WHO_COOKIE)?.value;
  if (!raw) return null;
  try {
    return decodeURIComponent(raw).trim().slice(0, 40) || null;
  } catch {
    return null;
  }
}
