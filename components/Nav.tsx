"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar } from "./People";

const LINKS = [
  { href: "/", label: "Home", icon: "M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" },
  { href: "/rooms", label: "Rooms", icon: "M4 4h16v16H4zM4 12h9M13 4v16" },
  { href: "/items", label: "Items", icon: "M4 7h16M4 12h16M4 17h10" },
  { href: "/find", label: "Find", icon: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm9 16-4-4" },
  { href: "/movein", label: "Move-in", icon: "M5 21V8l7-5 7 5v13M10 21v-6h4v6" },
  { href: "/value", label: "Value", icon: "M4 19h16M6 16V9m6 7V5m6 11v-4" },
];

export function Nav({ houseName, rooms, who }: { houseName: string; rooms: { id: string; name: string; count: number }[]; who: string | null }) {
  const path = usePathname();
  const active = (href: string) => (href === "/" ? path === "/" : path === href || (href !== "/rooms" && path.startsWith(href)));

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line/70 bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex min-w-0 items-center gap-2">
            <img src="/icon.svg" alt="" className="size-7" />
            <span className="truncate font-display text-xl tracking-tight">{houseName}</span>
          </Link>
          <div className="flex items-center gap-2">
          <nav className="hidden gap-1 sm:flex">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href}
                className={`rounded-full px-3.5 py-1.5 text-sm transition ${active(l.href) ? "bg-ink text-paper" : "text-muted hover:bg-sunken hover:text-ink"}`}>
                {l.label}
              </Link>
            ))}
          </nav>
          {who && (
            <button onClick={() => window.dispatchEvent(new Event("who:change"))} title={`You’re ${who}. Tap to change.`}
              className="ml-1 flex items-center gap-2 rounded-full py-1 pl-1 pr-2.5 text-[13px] text-muted hover:bg-sunken hover:text-ink">
              <Avatar name={who} size={26} /> <span className="hidden md:inline">{who}</span>
            </button>
          )}
          </div>
        </div>

        {/* Room strip — jump straight into any room */}
        {rooms.length > 0 && (
          <div className="mx-auto max-w-6xl">
            <nav aria-label="Rooms" className="flex gap-1.5 overflow-x-auto px-4 pb-2.5 [scrollbar-width:none] sm:px-6">
              {rooms.map((r) => {
                const on = path === `/rooms/${r.id}`;
                return (
                  <Link key={r.id} href={`/rooms/${r.id}`} aria-current={on ? "page" : undefined}
                    className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] transition ${
                      on ? "border-accent bg-accent-soft font-medium text-accent" : "border-line bg-surface text-muted hover:border-faint hover:text-ink"
                    }`}>
                    {r.name}
                    {r.count > 0 && <span className={`tabular-nums text-[11px] ${on ? "text-accent/70" : "text-faint"}`}>{r.count}</span>}
                  </Link>
                );
              })}
              <Link href="/rooms" className="shrink-0 rounded-full px-3 py-1 text-[13px] text-faint hover:text-ink">+ Room</Link>
            </nav>
          </div>
        )}
      </header>

      {/* Phone tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden">
        <div className="grid grid-cols-6">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={`flex flex-col items-center gap-1 py-2.5 text-[11px] ${active(l.href) || (l.href === "/rooms" && path.startsWith("/rooms")) ? "text-accent" : "text-muted"}`}>
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d={l.icon} />
              </svg>
              {l.label}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
