import { NextResponse } from "next/server";
import { ACCESS_COOKIE } from "@/lib/access";

/** The invite link: {site}/join/{INVITE_CODE}. Sets the access cookie, then opens the house. */
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const expected = process.env.INVITE_CODE;
  const home = new URL("/", req.url);
  if (!expected || code !== expected) return NextResponse.redirect(home);

  const res = NextResponse.redirect(home);
  res.cookies.set(ACCESS_COOKIE, code, {
    httpOnly: true, sameSite: "lax", secure: home.protocol === "https:", path: "/", maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
