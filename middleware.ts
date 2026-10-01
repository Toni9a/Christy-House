import { NextResponse, type NextRequest } from "next/server";

/**
 * Access control. Set INVITE_CODE and the site asks for a first name before
 * letting anyone in — no code to remember, just /welcome. The /join/{code}
 * link still works too, for anyone who has it. Left unset (e.g. on your own
 * computer), the site is open to everyone.
 *
 * Changing INVITE_CODE is a kill switch: both ways in stop granting access
 * (existing cookies no longer match), and people have to come back through
 * /welcome or a fresh /join/{code} link.
 *
 * Not gated: /welcome and the join link themselves, the SMS webhook (it checks
 * Twilio's signature instead), and uploaded files (their names are long and
 * random, and Google Lens has to be able to fetch them).
 */
import { ACCESS_COOKIE } from "@/lib/access";

export function middleware(req: NextRequest) {
  const code = process.env.INVITE_CODE;
  if (!code || req.cookies.get(ACCESS_COOKIE)?.value === code) return NextResponse.next();

  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Open the invite link first." }, { status: 401 });
  }
  const welcome = new URL("/welcome", req.url);
  welcome.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(welcome);
}

export const config = { matcher: ["/((?!welcome|join/|api/sms|api/files|api/enter|_next/static|_next/image|favicon.ico|icon.svg).*)"] };
