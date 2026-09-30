"use client";
import { useId } from "react";

export function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <div className={`rounded-2xl border border-line bg-surface ${className}`}>{children}</div>;
}

export function Label({ children, hint }: { children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3">
      <span className="text-[13px] font-medium text-ink">{children}</span>
      {hint != null && <span className="text-[13px] tabular-nums text-muted">{hint}</span>}
    </div>
  );
}

const track = (lo: number, hi: number) =>
  `linear-gradient(to right, var(--line) ${lo}%, var(--accent) ${lo}%, var(--accent) ${hi}%, var(--line) ${hi}%)`;

export function Slider(props: {
  label: string; value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void; format?: (v: number) => string; ends?: [string, string];
}) {
  const { value, min, max, step = 1 } = props;
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <Label hint={props.format?.(value) ?? value}>{props.label}</Label>
      <div className="relative flex h-5 items-center">
        <div className="absolute inset-x-0 h-1 rounded-full" style={{ background: track(0, pct) }} />
        <input
          type="range" className="range relative" aria-label={props.label}
          min={min} max={max} step={step} value={value}
          onChange={(e) => props.onChange(Number(e.target.value))}
        />
      </div>
      {props.ends && (
        <div className="mt-1.5 flex justify-between text-[11px] uppercase tracking-wide text-faint">
          <span>{props.ends[0]}</span><span>{props.ends[1]}</span>
        </div>
      )}
    </div>
  );
}

/** Two thumbs on one track — used for the budget. */
export function RangeSlider(props: {
  label: string; value: [number, number]; min: number; max: number; step?: number;
  onChange: (v: [number, number]) => void; format: (v: number) => string;
}) {
  const { min, max, step = 10 } = props;
  const [lo, hi] = props.value;
  const p = (v: number) => ((v - min) / (max - min)) * 100;
  const gap = step * 2;
  return (
    <div>
      <Label hint={`${props.format(lo)} – ${props.format(hi)}${hi >= max ? "+" : ""}`}>{props.label}</Label>
      <div className="relative flex h-5 items-center">
        <div className="absolute inset-x-0 h-1 rounded-full" style={{ background: track(p(lo), p(hi)) }} />
        <input type="range" className="range absolute" aria-label={`${props.label} minimum`} min={min} max={max} step={step}
          value={lo} onChange={(e) => props.onChange([Math.min(Number(e.target.value), hi - gap), hi])} />
        <input type="range" className="range absolute" aria-label={`${props.label} maximum`} min={min} max={max} step={step}
          value={hi} onChange={(e) => props.onChange([lo, Math.max(Number(e.target.value), lo + gap)])} />
      </div>
    </div>
  );
}

export function Segmented<T extends string>(props: {
  label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void;
}) {
  const id = useId();
  return (
    <div>
      <Label>{props.label}</Label>
      <div role="radiogroup" aria-labelledby={id} className="grid auto-cols-fr grid-flow-col rounded-xl bg-sunken p-1">
        {props.options.map((o) => (
          <button
            key={o.value} type="button" role="radio" aria-checked={props.value === o.value}
            onClick={() => props.onChange(o.value)}
            className={`rounded-lg px-2 py-1.5 text-[13px] transition ${
              props.value === o.value ? "bg-surface font-medium text-ink shadow-sm" : "text-muted hover:text-ink"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button" aria-pressed={on} onClick={onClick}
      className={`rounded-full border px-3 py-1 text-[13px] transition ${
        on ? "border-ink bg-ink text-paper" : "border-line bg-surface text-muted hover:border-faint hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

export function Button({
  variant = "primary", className = "", ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "quiet" }) {
  const styles = {
    primary: "bg-accent text-accent-ink hover:brightness-110 disabled:opacity-50",
    ghost: "border border-line bg-surface text-ink hover:bg-sunken",
    quiet: "text-muted hover:text-ink hover:bg-sunken",
  }[variant];
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed ${styles} ${className}`}
    />
  );
}

export const inputCls =
  "w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-faint outline-none transition focus:border-accent focus:ring-4 focus:ring-accent-soft";

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">{children}</p>;
}
