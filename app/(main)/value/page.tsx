import type { Metadata } from "next";
import { CompsChart } from "@/components/CompsChart";
import { Card, Eyebrow } from "@/components/ui";
import { valuation as v } from "@/lib/valuation";

export const metadata: Metadata = { title: "Value · Christy’s House" };

const gbp = (n: number, pence = false) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: pence ? 2 : 0, maximumFractionDigits: pence ? 2 : 0 }).format(n);

export default function ValuePage() {
  const best = v.comparables.filter((c) => c.weight !== "caution");
  const caution = v.comparables.filter((c) => c.weight === "caution");
  const taxMonthly = Math.round((v.costs.councilTax.yearly / 12) * 100) / 100;
  const monthly = Math.round((taxMonthly + v.costs.energy.monthly) * 100) / 100;
  const rangePos = ((v.estimate - v.low) / (v.high - v.low)) * 100;

  return (
    <div className="space-y-16">
      {/* ── The number ─────────────────────────────── */}
      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-10">
        <div className="relative min-h-72 overflow-hidden rounded-3xl bg-sunken lg:min-h-full">
          <img src="/valuation/hero.webp" alt="A woman in a wide straw hat tending lavender and rosemary in a cottage garden"
            className="absolute inset-0 size-full object-cover object-[center_30%]" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-transparent" />
          <div className="absolute inset-x-6 bottom-6 text-white">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/80">A considered look at the house</p>
            <p className="mt-2 font-display text-4xl leading-[1.02] sm:text-5xl">A place to<br /><em>put down roots.</em></p>
          </div>
        </div>

        <div className="flex flex-col justify-center">
          <Eyebrow>Working valuation · {v.area}</Eyebrow>
          <h1 className="font-display text-4xl leading-none sm:text-6xl">{v.address}</h1>
          <p className="mt-2 font-display text-xl text-muted">{v.postcode}</p>

          <Card className="mt-6 p-6 sm:p-7">
            <div className="flex items-center justify-between gap-3 text-[13px]">
              <span className="font-medium">Estimated market value</span>
              <span className="flex items-center gap-1.5 text-muted"><span className="size-2 rounded-full bg-fit" /> {v.confidence} confidence</span>
            </div>
            <p className="mt-3 font-display text-6xl tabular-nums tracking-tight text-ink sm:text-7xl">{gbp(v.estimate)}</p>
            <div className="mt-5">
              <div className="flex justify-between text-[13px] tabular-nums text-muted">
                <span>{gbp(v.low)}</span><span className="text-faint">likely range</span><span>{gbp(v.high)}</span>
              </div>
              <div className="relative mt-2 h-2 rounded-full bg-fit-soft">
                <span className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-accent shadow" style={{ left: `${rangePos}%` }} />
              </div>
            </div>
            <p className="mt-5 text-[13px] leading-relaxed text-muted">
              A researched desktop estimate from {v.asOf}, not a survey or an offer. Condition, garden, parking and any alterations still need checking.
            </p>
          </Card>

          <div className="mt-5 grid grid-cols-4 divide-x divide-line rounded-2xl border border-line bg-surface">
            {v.facts.map((f) => (
              <div key={f.label} className="min-w-0 px-3 py-3.5 sm:px-4">
                <p className="truncate font-display text-xl sm:text-2xl">{f.value}</p>
                <p className="text-[11px] text-muted">{f.label}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 rounded-xl bg-warn-soft px-4 py-3 text-[13px] leading-relaxed text-warn">{v.bedroomNote}</p>
        </div>
      </section>

      {/* ── Evidence ───────────────────────────────── */}
      <section>
        <div className="mb-6 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <div>
            <Eyebrow>The evidence</Eyebrow>
            <h2 className="font-display text-3xl sm:text-4xl">Homes worth comparing</h2>
          </div>
          <p className="max-w-sm text-sm text-muted">Nearby completed sales. The closest two-bedroom matches count most; the grey ones are context only.</p>
        </div>

        <Card className="p-5 sm:p-6"><CompsChart comps={v.comparables} estimate={v.estimate} low={v.low} high={v.high} /></Card>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {best.map((c) => (
            <article key={c.address} className="flex flex-col rounded-2xl border border-line bg-surface p-5">
              <div className="flex items-center justify-between gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${c.weight === "strong" ? "bg-fit-soft text-fit" : "bg-sunken text-muted"}`}>{c.type}</span>
                <span className="text-[11px] text-faint">{c.weight === "strong" ? "Strong match" : "Supporting"}</span>
              </div>
              <h3 className="mt-5 font-display text-2xl leading-tight">{c.address}</h3>
              <p className="text-[13px] text-muted">Freehold · Sold {c.date}</p>
              <div className="mt-auto flex items-end justify-between gap-2 pt-6">
                <p className="font-display text-3xl tabular-nums">{gbp(c.price)}</p>
                <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-[12px] text-accent underline underline-offset-2">Sale record ↗</a>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {caution.map((c) => (
            <article key={c.address} className="rounded-2xl border border-dashed border-line p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-display text-xl">{c.address}</h3>
                <p className="font-display text-xl tabular-nums text-muted">{gbp(c.price)}</p>
              </div>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">{c.date} · {"why" in c ? c.why : ""}</p>
              <a href={c.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-[12px] text-accent underline underline-offset-2">Record ↗</a>
            </article>
          ))}
        </div>
        <p className="mt-4 text-[13px] text-muted">The {gbp(v.estimate)} figure is a judgement based on these records. It isn’t a live algorithm and doesn’t update by itself.</p>
      </section>

      {/* ── Running costs ──────────────────────────── */}
      <section>
        <div className="mb-6 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <div>
            <Eyebrow>Beyond the price</Eyebrow>
            <h2 className="font-display text-3xl sm:text-4xl">What it costs to live there</h2>
          </div>
          <p className="max-w-sm text-sm text-muted">Dated snapshots from {v.asOf}. Check them again before deciding anything.</p>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1fr_2fr]">
          <div className="flex flex-col justify-between rounded-2xl bg-ink p-6 text-paper">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-paper/60">Known monthly costs</p>
              <p className="mt-3 font-display text-5xl tabular-nums">{gbp(monthly, true)}</p>
              <p className="mt-1 text-sm text-paper/70">a month, before broadband, water and insurance</p>
            </div>
            <dl className="mt-6 space-y-2 border-t border-paper/15 pt-4 text-sm tabular-nums">
              <div className="flex justify-between"><dt className="text-paper/70">Council tax (Band {v.costs.councilTax.band})</dt><dd>{gbp(taxMonthly, true)}</dd></div>
              <div className="flex justify-between"><dt className="text-paper/70">Energy (Octopus estimate)</dt><dd>{gbp(v.costs.energy.monthly, true)}</dd></div>
            </dl>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { label: "Council tax", head: `Band ${v.costs.councilTax.band} · ${gbp(v.costs.councilTax.yearly, true)} a year`, ...v.costs.councilTax, link: "Bromley charges" },
              { label: "Energy", head: `${gbp(v.costs.energy.monthly, true)} a month`, ...v.costs.energy, link: "Get a fresh quote" },
              { label: "Broadband", head: v.costs.broadband.headline, ...v.costs.broadband, link: "Ofcom result" },
              { label: "Local market", head: "Bromley trends", ...v.costs.market, link: "ONS house prices" },
            ].map((c) => (
              <article key={c.label} className="flex flex-col rounded-2xl border border-line bg-surface p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-fit">{c.label}</p>
                <h3 className="mt-2 font-display text-2xl leading-tight">{c.head}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-muted">{c.note}</p>
                <a href={c.url} target="_blank" rel="noopener noreferrer" className="mt-auto pt-4 text-[13px] font-medium text-accent">{c.link} ↗</a>
              </article>
            ))}
          </div>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {v.evidence.map((e) => (
            <figure key={e.title} className="m-0 rounded-2xl border border-line bg-surface p-4">
              <a href={e.src} target="_blank" rel="noopener noreferrer" className="grid h-64 place-items-center overflow-hidden rounded-xl bg-sunken p-3">
                <img src={e.src} alt={e.alt} loading="lazy" className="max-h-full max-w-full rounded object-contain shadow" />
              </a>
              <figcaption className="mt-3 flex items-center justify-between gap-3 text-[13px]">
                <span><b className="font-medium">{e.title}</b> <span className="text-muted">· snapshot {v.asOf}</span></span>
                <a href={e.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-accent">Check now ↗</a>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* ── Sources ────────────────────────────────── */}
      <section className="grid gap-6 rounded-3xl bg-sunken p-6 sm:p-10 lg:grid-cols-2">
        <div>
          <Eyebrow>Open book</Eyebrow>
          <h2 className="font-display text-3xl sm:text-4xl">Where the details come from</h2>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
            Property records can disagree. This page uses two bedrooms and should be updated if the layout turns out different. Broadband and energy figures are dated snapshots, not live feeds.
          </p>
        </div>
        <ul className="divide-y divide-line">
          {v.sources.map((s) => (
            <li key={s.url + s.label}>
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-3 py-3 text-sm hover:text-accent">{s.label}<span aria-hidden>↗</span></a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
