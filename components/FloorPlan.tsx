import type { Dimensions } from "@/lib/types";

/** A to-scale rectangle of the room's footprint — a quick visual sense of proportion. */
export function FloorPlan({ dims, className = "" }: { dims: Dimensions; className?: string }) {
  const { width: w, depth: d } = dims;
  if (!w || !d) {
    return (
      <div className={`flex items-center justify-center rounded-xl bg-sunken text-xs text-faint ${className}`}>
        No measurements yet
      </div>
    );
  }
  const box = 100, pad = 14;
  const scale = (box - pad * 2) / Math.max(w, d);
  const rw = w * scale, rd = d * scale;
  const x = (box - rw) / 2, y = (box - rd) / 2;
  return (
    <svg viewBox={`0 0 ${box} ${box}`} className={`rounded-xl bg-sunken ${className}`} role="img" aria-label={`${w} by ${d} centimetre floor plan`}>
      <defs>
        <pattern id="grid" width="5" height="5" patternUnits="userSpaceOnUse">
          <path d="M5 0H0V5" fill="none" stroke="var(--line)" strokeWidth="0.3" />
        </pattern>
      </defs>
      <rect x={x} y={y} width={rw} height={rd} fill="url(#grid)" stroke="var(--ink)" strokeWidth="1.2" rx="0.5" />
      <text x={box / 2} y={y - 4} textAnchor="middle" fontSize="5.5" fill="var(--muted)">{Math.round(w)} cm</text>
      <text x={x + rw + 4} y={box / 2} fontSize="5.5" fill="var(--muted)" dominantBaseline="middle"
        transform={`rotate(90 ${x + rw + 4} ${box / 2})`} textAnchor="middle">{Math.round(d)} cm</text>
    </svg>
  );
}
