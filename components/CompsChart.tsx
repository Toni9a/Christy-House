import { money } from "@/lib/config";
import type { Comparable } from "@/lib/valuation";

/**
 * Each comparable sale on one shared price scale, with the estimate range shaded.
 * Built from HTML rows (not a fixed-size SVG) so labels stay readable on a phone.
 */
export function CompsChart({ comps, estimate, low, high }: { comps: readonly Comparable[]; estimate: number; low: number; high: number }) {
  const min = 275_000, max = 440_000;
  const pct = (v: number) => ((v - min) / (max - min)) * 100;
  const ticks = [300_000, 350_000, 400_000];
  const rows = [...comps].sort((a, b) => b.price - a.price);

  return (
    <figure className="m-0">
      <div className="space-y-1">
        {rows.map((c) => {
          const muted = c.weight === "caution";
          return (
            <div key={c.address} className="grid grid-cols-[minmax(0,8.5rem)_1fr] items-center gap-3 sm:grid-cols-[12rem_1fr]">
              <p className={`truncate text-[13px] ${muted ? "text-faint" : "text-ink"}`} title={c.address}>{c.address}</p>
              <div className="relative h-9">
                <div className="absolute inset-y-0 bg-fit-soft" style={{ left: `${pct(low)}%`, width: `${pct(high) - pct(low)}%` }} />
                <div className="absolute inset-y-0 w-px bg-accent/70" style={{ left: `${pct(estimate)}%` }} />
                <div className="absolute inset-x-0 top-1/2 h-px bg-line" />
                <span className={`absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ${
                  muted ? "border-2 border-faint bg-surface" : c.weight === "strong" ? "bg-fit" : "border-2 border-fit bg-surface"
                }`} style={{ left: `${pct(c.price)}%` }} />
                <span className={`absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-[11px] tabular-nums ${muted ? "text-faint" : "text-muted"} ${
                  pct(c.price) > 70 ? "-translate-x-full pr-3" : "pl-3"}`} style={{ left: `${pct(c.price)}%` }}>
                  {money(c.price, "GBP")}
                </span>
              </div>
            </div>
          );
        })}
        {/* Axis */}
        <div className="grid grid-cols-[minmax(0,8.5rem)_1fr] gap-3 sm:grid-cols-[12rem_1fr]">
          <span />
          <div className="relative h-6 border-t border-line">
            {ticks.map((t) => (
              <span key={t} className="absolute top-1 -translate-x-1/2 text-[11px] tabular-nums text-faint" style={{ left: `${pct(t)}%` }}>£{t / 1000}k</span>
            ))}
          </div>
        </div>
      </div>
      <figcaption className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[12px] text-muted">
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-fit" /> Strong match</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full border-2 border-fit" /> Supporting</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full border-2 border-faint" /> Use with caution</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-4 bg-fit-soft" /> Estimate range</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-px bg-accent" /> £{estimate / 1000}k estimate</span>
      </figcaption>
    </figure>
  );
}
