"use client";
import { useEffect, useMemo, useState } from "react";
import { currencySymbol } from "@/lib/config";
import { handoffLinks, SOURCES } from "@/lib/sources";
import type { Filters, Item, Product, Room, Search, SourceId } from "@/lib/types";
import { uploadFile } from "@/lib/upload";
import { ProductCard, ProductSkeleton } from "./ProductCard";
import { Dropzone } from "./Dropzone";
import { VisualizeDialog } from "./VisualizeDialog";
import { Button, Card, Chip, Eyebrow, Label, RangeSlider, Segmented, Slider, inputCls } from "./ui";

const PROGRESS = [
  "Looking closely at the piece…",
  "Working out shape, fabric and colour…",
  "Searching retailers…",
  "Checking second-hand listings…",
  "Comparing prices and sizes…",
  "Shortlisting the best matches…",
];

type Sort = "match" | "low" | "high";

export function Finder(props: {
  rooms: Room[];
  currency: string;
  initial: Search | null;
  initialRoomId: string | null;
  /** "Find it cheaper" from an item: start from its photo and price. */
  fromItem?: Pick<Item, "id" | "title" | "price" | "image_url"> | null;
  geminiEnabled: boolean;
}) {
  const sym = currencySymbol(props.currency);
  const roomOf = (id: string | null) => props.rooms.find((r) => r.id === id) ?? null;

  const from = props.fromItem ?? null;
  const [image, setImage] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<string | null>(props.initial?.imageFile ?? null);
  const [itemId, setItemId] = useState<string | null>(from?.image_url ? from.id : null);
  const [preview, setPreview] = useState<string | null>(
    props.initial?.imageFile ? `/api/files/${props.initial.imageFile}` : from?.image_url ?? null,
  );
  const [link, setLink] = useState(props.initial?.link ?? "");
  const [query, setQuery] = useState(props.initial?.query ?? (from ? `Like this ${from.title}, but cheaper` : ""));
  const [sending, setSending] = useState(false);
  const [filters, setFilters] = useState<Filters>(
    props.initial?.filters ?? {
      minPrice: 0, maxPrice: from?.price ? Math.max(20, Math.round(from.price / 10) * 10) : 1000, closeness: from ? 75 : 60, condition: "any", sources: ["anywhere"],
      roomId: props.initialRoomId, maxWidth: roomOf(props.initialRoomId)?.dims.width ?? null,
    },
  );
  const [search, setSearch] = useState<Search | null>(props.initial);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("match");
  const [tick, setTick] = useState(0);
  const [visualizing, setVisualizing] = useState<Product | null>(null);

  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setFilters((f) => ({ ...f, [k]: v }));
  const running = search?.status === "running";

  // Poll while the search runs in the background.
  useEffect(() => {
    if (!running || !search) return;
    const t = setInterval(async () => {
      setTick((n) => n + 1);
      const res = await fetch(`/api/searches/${search.id}`);
      if (res.ok) {
        const next: Search = await res.json();
        if (next.status !== "running") setSearch(next);
      }
    }, 2500);
    return () => clearInterval(t);
  }, [running, search]);

  function pickImage(f: File | null) {
    setImage(f);
    setImageFile(null);
    setItemId(null);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  function toggleSource(id: SourceId) {
    setFilters((f) => {
      if (id === "anywhere") return { ...f, sources: ["anywhere"] };
      const rest = f.sources.filter((s) => s !== "anywhere");
      const next = rest.includes(id) ? rest.filter((s) => s !== id) : [...rest, id];
      return { ...f, sources: next.length ? next : ["anywhere"] };
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSending(true);
    let data;
    try {
      const file = image ? await uploadFile(image) : imageFile;
      if (image) { setImage(null); setImageFile(file); }
      const res = await fetch("/api/find", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ query, link, filters, imageFile: file, itemId: file ? null : itemId }),
      });
      data = await res.json();
      if (!res.ok) throw new Error(data.error);
    } catch (err) {
      setSending(false);
      return setError(err instanceof Error ? err.message : "Couldn't start the search.");
    }
    setSending(false);
    setTick(0);
    setSearch({ id: data.id, status: "running", products: [], filters } as unknown as Search);
    window.history.replaceState(null, "", `/find/${data.id}`);
    if (window.innerWidth < 1024) document.getElementById("results")?.scrollIntoView({ behavior: "smooth" });
  }

  async function save(p: Product, roomId: string | null) {
    await fetch("/api/items", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ product: p, roomId }) });
  }

  const products = useMemo(() => {
    const list = [...(search?.products ?? [])];
    if (sort === "low") list.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
    if (sort === "high") list.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
    return list;
  }, [search?.products, sort]);

  const handoffQuery = search?.identified?.search_terms[0] || query || search?.identified?.name || "";
  const room = roomOf(filters.roomId);

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr] lg:gap-10">
      {/* ── Composer + sliders ───────────────────────────── */}
      <form onSubmit={submit} className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <Card className="space-y-3 p-4">
          <Dropzone preview={preview} onFile={pickImage} />
          <input className={inputCls} type="url" inputMode="url" placeholder="…or paste a product link"
            value={link} onChange={(e) => setLink(e.target.value)} />
          <textarea className={`${inputCls} min-h-20 resize-y`} placeholder="Describe it — “deep green velvet sofa, low arms, seats 3”"
            value={query} onChange={(e) => setQuery(e.target.value)} />
        </Card>

        <Card className="space-y-6 p-5">
          <div>
            <Label>For which room?</Label>
            <select className={inputCls} value={filters.roomId ?? ""}
              onChange={(e) => {
                const r = roomOf(e.target.value || null);
                setFilters((f) => ({ ...f, roomId: r?.id ?? null, maxWidth: r?.dims.width ?? f.maxWidth }));
              }}>
              <option value="">Anywhere in the house</option>
              {props.rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}{r.dims.width && r.dims.depth ? ` — ${Math.round(r.dims.width)}×${Math.round(r.dims.depth)} cm` : ""}
                </option>
              ))}
            </select>
          </div>

          <RangeSlider label="Budget" min={0} max={5000} step={10}
            value={[filters.minPrice, filters.maxPrice]}
            onChange={([lo, hi]) => setFilters((f) => ({ ...f, minPrice: lo, maxPrice: hi }))}
            format={(v) => `${sym}${v.toLocaleString()}`} />

          <Slider label="Max width" min={0} max={400} step={5}
            value={filters.maxWidth ?? 0} onChange={(v) => set("maxWidth", v === 0 ? null : v)}
            format={(v) => (v === 0 ? "No limit" : `${v} cm`)}
            ends={["No limit", room?.dims.width ? `Room: ${Math.round(room.dims.width)} cm` : "4 m"]} />

          <Slider label="How close a match?" min={0} max={100} step={5}
            value={filters.closeness} onChange={(v) => set("closeness", v)}
            format={(v) => (v >= 75 ? "Exact dupe" : v >= 40 ? "Similar" : "Same vibe")}
            ends={["Same vibe", "Exact dupe"]} />

          <Segmented label="Condition" value={filters.condition} onChange={(v) => set("condition", v)}
            options={[{ value: "any", label: "Either" }, { value: "new", label: "New" }, { value: "used", label: "Second-hand" }]} />

          <div>
            <Label>Where to look</Label>
            <div className="flex flex-wrap gap-1.5">
              {SOURCES.map((s) => (
                <Chip key={s.id} on={filters.sources.includes(s.id)} onClick={() => toggleSource(s.id)}>{s.label}</Chip>
              ))}
            </div>
          </div>
        </Card>

        {error && <p className="rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn">{error}</p>}
        <Button type="submit" disabled={sending || running || (!image && !preview && !link && !query)} className="w-full py-3.5 text-[15px]">
          {sending ? "Sending…" : running ? "Searching…" : search ? "Search again" : "Find matches"}
        </Button>
      </form>

      {/* ── Results ──────────────────────────────────────── */}
      <section id="results" className={`min-w-0 scroll-mt-20 ${search ? "order-first lg:order-none" : ""}`}>
        {!search && <EmptyState onPick={(q) => setQuery(q)} />}

        {running && (
          <div>
            <Eyebrow>Working on it</Eyebrow>
            <h2 className="font-display text-3xl" aria-live="polite">{PROGRESS[Math.min(Math.floor(tick / 4), PROGRESS.length - 1)]}</h2>
            <p className="mt-2 text-sm text-muted">Usually 30–90 seconds. You can leave this page — results are saved.</p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }, (_, i) => <ProductSkeleton key={i} />)}
            </div>
          </div>
        )}

        {search?.status === "error" && (
          <Card className="p-6">
            <h2 className="font-display text-2xl">That search didn’t land</h2>
            <p className="mt-2 text-sm text-muted">{search.error}</p>
          </Card>
        )}

        {search?.status === "done" && (
          <div>
            <Eyebrow>{products.length} matches{room ? ` · for the ${room.name}` : ""}</Eyebrow>
            <h2 className="font-display text-3xl leading-tight sm:text-4xl">{search.identified?.name}</h2>
            {search.identified && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {[search.identified.style, ...search.identified.materials, ...search.identified.colors].filter(Boolean).map((t) => (
                  <span key={t} className="rounded-full bg-sunken px-2.5 py-0.5 text-xs text-muted">{t}</span>
                ))}
              </div>
            )}
            {search.summary && <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted">{search.summary}</p>}

            <div className="mt-8 flex items-center justify-between gap-4">
              <p className="text-sm text-muted">Sorted by</p>
              <div className="flex gap-1">
                {(["match", "low", "high"] as Sort[]).map((s) => (
                  <Chip key={s} on={sort === s} onClick={() => setSort(s)}>{{ match: "Best match", low: "Price ↑", high: "Price ↓" }[s]}</Chip>
                ))}
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {products.map((p) => (
                <ProductCard key={p.url} product={p} maxWidth={filters.maxWidth} onSave={(roomId) => save(p, roomId)}
                  rooms={props.rooms} roomId={filters.roomId}
                  onVisualize={props.geminiEnabled ? () => setVisualizing(p) : undefined} />
              ))}
            </div>
            {!products.length && <p className="mt-6 text-muted">Nothing inside those limits — try widening the budget or width.</p>}

            {handoffQuery && (
              <Card className="mt-10 p-5">
                <Label>Keep browsing with these filters</Label>
                <p className="mb-3 text-[13px] text-muted">Marketplace and some shops can’t be searched directly — these open pre-filtered searches.</p>
                <div className="flex flex-wrap gap-2">
                  {handoffLinks(handoffQuery, filters).map((l) => (
                    <a key={l.id} href={l.url} target="_blank" rel="noopener noreferrer"
                      className="rounded-full border border-line px-3 py-1.5 text-[13px] transition hover:border-ink">
                      {l.label} ↗
                    </a>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}
      </section>

      <VisualizeDialog product={visualizing} onClose={() => setVisualizing(null)} />
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (q: string) => void }) {
  const ideas = [
    "Cloud-style modular sofa in oatmeal, under £1,200",
    "Linen duvet set, king, sage or clay",
    "Round travertine dining table, seats 4",
    "Mid-century sideboard, walnut, max 160 cm",
  ];
  return (
    <div className="flex min-h-[50vh] flex-col justify-center rounded-3xl border border-dashed border-line px-6 py-12 sm:px-12">
      <Eyebrow>Visual search</Eyebrow>
      <h2 className="max-w-lg font-display text-4xl leading-[1.1] sm:text-5xl">Show me something you love. I’ll find it at your price.</h2>
      <p className="mt-4 max-w-md text-[15px] leading-relaxed text-muted">
        Drop in a screenshot from Instagram, a Pinterest pin, a link from any shop — or just describe it. Set your budget and the room it’s for.
      </p>
      <div className="mt-8 flex flex-wrap gap-2">
        {ideas.map((i) => (
          <button key={i} type="button" onClick={() => onPick(i)}
            className="rounded-full bg-surface px-3.5 py-2 text-left text-[13px] text-muted ring-1 ring-line transition hover:text-ink hover:ring-faint">
            {i}
          </button>
        ))}
      </div>
    </div>
  );
}
