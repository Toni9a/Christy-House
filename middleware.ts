import { NextResponse, type NextRequest } from "next/server";

/**
 * Invite-link access. Set INVITE_CODE and share  {site}/join/{INVITE_CODE}.
 * Opening that link sets a cookie that lasts a year; anyone without it sees a
 * short "private house" page. Left unset (e.g. on your own computer), the site is open.
 *
 * Not gated: the join link itself, the SMS webhook (it checks Twilio's
 * signature instead), and uploaded files (their names are long and random,
 * and Google Lens has to be able to fetch them).
 */
import { ACCESS_COOKIE } from "@/lib/access";

export function middleware(req: NextRequest) {
  const code = process.env.INVITE_CODE;
  if (!code || req.cookies.get(ACCESS_COOKIE)?.value === code) return NextResponse.next();

  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Open the invite link first." }, { status: 401 });
  }
  return new NextResponse(LOCKED_PAGE, { status: 401, headers: { "content-type": "text/html; charset=utf-8" } });
}

export const config = { matcher: ["/((?!join/|api/sms|api/files|_next/static|_next/image|favicon.ico|icon.svg).*)"] };

const LOCKED_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Private house</title><style>
:root{--bg:#f5f1ea;--fg:#1d1b18;--muted:#6f6a62;--accent:#b5582f}
@media (prefers-color-scheme:dark){:root{--bg:#141311;--fg:#f1ece3;--muted:#a39c90;--accent:#e08a5f}}
body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--fg);font:16px/1.5 ui-sans-serif,system-ui,sans-serif;padding:0 24px}
h1{font:400 34px/1.1 ui-serif,Georgia,serif;margin:0 0 10px}p{color:var(--muted);max-width:26rem;margin:0}
.dot{width:36px;height:36px;border-radius:10px;background:var(--accent);margin-bottom:22px}
</style></head><body><main><div class="dot"></div><h1>This house is private</h1>
<p>Open the invite link you were sent to get in. If you've lost it, ask whoever shared it with you.</p></main></body></html>`;
