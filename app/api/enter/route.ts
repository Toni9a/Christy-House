import { NextResponse } from "next/server";
import { ACCESS_COOKIE } from "@/lib/access";
import { WHO_COOKIE } from "@/lib/identity";

/**
 * The front door for the plain link: give your name, get in. Sets the same
 * access cookie the /join/{code} link sets (so INVITE_CODE still works as a
 * kill switch — change it and this stops granting access too) plus your name.
 */
export async function POST(req: Request) {
  const code = process.env.INVITE_CODE;
  const form = await req.formData();
  const name = String(form.get("name") ?? "").trim().slice(0, 40);
  const nextPath = String(form.get("next") ?? "/");
  const safeNext = nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/";

  if (!name) return NextResponse.redirect(new URL(`/welcome?next=${encodeURIComponent(safeNext)}&error=1`, req.url));

  const res = NextResponse.redirect(new URL(safeNext, req.url));
  const secure = new URL(req.url).protocol === "https:";
  if (code) res.cookies.set(ACCESS_COOKIE, code, { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: 60 * 60 * 24 * 365 });
  res.cookies.set(WHO_COOKIE, encodeURIComponent(name), { sameSite: "lax", secure, path: "/", maxAge: 60 * 60 * 24 * 365 });
  return res;
}
