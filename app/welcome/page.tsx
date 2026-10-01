import { config } from "@/lib/config";

export const dynamic = "force-dynamic";

/**
 * The front door: shown instead of the app to anyone without the access
 * cookie. No code to remember — just a name — so the plain link works as
 * well as the /join/{code} one. INVITE_CODE still acts as a kill switch:
 * change it and both ways in stop working until people re-enter here.
 */
export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <main className="flex min-h-dvh items-center justify-center bg-paper px-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2">
          <img src="/icon.svg" alt="" className="size-8" />
          <span className="font-display text-2xl">{config.houseName}</span>
        </div>
        <h1 className="font-display text-3xl leading-tight">What’s your name?</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">
          So everyone knows who added or said what. No password needed — just this.
        </p>
        <form action="/api/enter" method="POST" className="mt-6 space-y-3">
          <input type="hidden" name="next" value={next ?? "/"} />
          <input
            name="name"
            autoFocus
            required
            maxLength={40}
            placeholder="Your first name"
            className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-base outline-none transition focus:border-accent focus:ring-4 focus:ring-accent-soft"
          />
          {error && <p className="text-sm text-warn">Type your name to get in.</p>}
          <button type="submit" className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-medium text-accent-ink transition hover:brightness-110">
            That’s me — let me in
          </button>
        </form>
      </div>
    </main>
  );
}
