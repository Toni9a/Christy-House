"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isPdf, MANUAL_CATEGORIES, METER_LINKED, type Fact, type Manual, type ManualFile } from "@/lib/manuals-types";
import { fileUrl, uploadFile } from "@/lib/upload";
import { Button, Card, inputCls } from "./ui";

/**
 * How things in the house work: manuals (PDFs), photos (the boiler, the meter cupboard) and short how-to notes,
 * so anyone can open the site and see what to do. Grouped by what they're about.
 */
export function Manuals({ manuals: initial }: { manuals: Manual[] }) {
  const router = useRouter();
  const [manuals, setManuals] = useState(initial);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [open, setOpen] = useState<string | null>(null); // image shown big
  useEffect(() => setManuals(initial), [initial]);

  async function remove(id: string) {
    setManuals((m) => m.filter((x) => x.id !== id));
    await fetch("/api/manuals", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
    router.refresh();
  }

  const groups = MANUAL_CATEGORIES.map((c) => [c, manuals.filter((m) => m.category === c)] as const).filter(([, l]) => l.length);

  return (
    <section id="manuals" className="scroll-mt-24">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl">Manuals & bills</h2>
          <p className="max-w-xl text-sm text-muted">How things work and what they cost: the boiler, the meters, the energy tariff and the broadband. Photos, the manual, and the key details.</p>
        </div>
        {editing !== "new" && <Button onClick={() => setEditing("new")}>+ Add</Button>}
      </div>

      {editing === "new" && <ManualForm onDone={(list) => { if (list) setManuals(list); setEditing(null); router.refresh(); }} />}

      {groups.length ? (
        <div className="space-y-8">
          {groups.map(([cat, list]) => (
            <div key={cat}>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-fit">{cat}</h3>
              <div className="grid gap-3 lg:grid-cols-2">
                {list.map((m) => editing === m.id ? (
                  <ManualForm key={m.id} manual={m} onDone={(l) => { if (l) setManuals(l); setEditing(null); router.refresh(); }} />
                ) : (
                  <article key={m.id} className="flex flex-col rounded-2xl border border-line bg-surface p-5">
                    <h4 className="font-display text-xl leading-tight">{m.title}</h4>
                    {m.facts && m.facts.length > 0 && <FactList facts={m.facts} />}
                    {m.notes && <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted">{m.notes}</p>}
                    {m.files.some((f) => !isPdf(f.file)) && (
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        {m.files.filter((f) => !isPdf(f.file)).map((f) => (
                          <button key={f.file} onClick={() => setOpen(f.file)} className="aspect-square overflow-hidden rounded-xl bg-sunken">
                            <img src={fileUrl(f.file)} alt={f.name} loading="lazy" className="size-full object-cover" />
                          </button>
                        ))}
                      </div>
                    )}
                    {m.files.some((f) => isPdf(f.file)) && (
                      <ul className="mt-3 space-y-1.5">
                        {m.files.filter((f) => isPdf(f.file)).map((f) => (
                          <li key={f.file}>
                            <a href={fileUrl(f.file)} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-3 rounded-xl border border-line px-3.5 py-2.5 text-sm transition hover:bg-sunken">
                              <span className="truncate">📄 {f.name}</span><span className="shrink-0 text-accent">Open ↗</span>
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-4 text-[13px] text-muted">
                      {METER_LINKED.includes(m.category) && <a href="#meter-readings" className="text-accent hover:underline">Meter readings ↑</a>}
                      <button onClick={() => setEditing(m.id)} className="hover:text-ink">Edit</button>
                      <button onClick={() => confirm(`Delete “${m.title}”?`) && remove(m.id)} className="hover:text-warn">Delete</button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : editing !== "new" && (
        <button onClick={() => setEditing("new")} className="flex w-full flex-col items-center gap-1 rounded-2xl border-2 border-dashed border-line px-6 py-10 text-center hover:bg-surface">
          <span className="font-medium">Nothing here yet</span>
          <span className="text-sm text-muted">Add the boiler, the meters, the energy tariff or the broadband, with photos and the key details</span>
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-4" onClick={() => setOpen(null)}>
          <img src={fileUrl(open)} alt="" className="max-h-full max-w-full object-contain" />
        </div>
      )}
    </section>
  );
}

/** Labelled details. Secret values (wifi passwords) stay hidden until tapped, and can be copied. */
function FactList({ facts }: { facts: Fact[] }) {
  const [shown, setShown] = useState<Record<number, boolean>>({});
  const [copied, setCopied] = useState<number | null>(null);
  return (
    <dl className="mt-3 divide-y divide-line rounded-xl border border-line text-sm">
      {facts.map((f, i) => (
        <div key={i} className="flex items-baseline justify-between gap-4 px-3.5 py-2">
          <dt className="shrink-0 text-muted">{f.label}</dt>
          <dd className="min-w-0 text-right tabular-nums">
            {!f.value ? <span className="text-faint">not added yet</span> : f.secret ? (
              <span className="inline-flex items-baseline gap-2">
                <span className="break-all">{shown[i] ? f.value : "••••••••"}</span>
                <button onClick={() => setShown((s) => ({ ...s, [i]: !s[i] }))} className="text-[12px] text-accent">{shown[i] ? "Hide" : "Show"}</button>
                <button onClick={() => { navigator.clipboard?.writeText(f.value).then(() => { setCopied(i); setTimeout(() => setCopied(null), 1500); }); }} className="text-[12px] text-accent">{copied === i ? "Copied" : "Copy"}</button>
              </span>
            ) : <span className="break-words">{f.value}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function ManualForm({ manual, onDone }: { manual?: Manual; onDone: (list: Manual[] | null) => void }) {
  const [title, setTitle] = useState(manual?.title ?? "");
  const [category, setCategory] = useState(manual?.category ?? "Boiler");
  const [notes, setNotes] = useState(manual?.notes ?? "");
  const [files, setFiles] = useState<ManualFile[]>(manual?.files ?? []);
  const [facts, setFacts] = useState<Fact[]>(manual?.facts ?? []);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function addFiles(list: FileList | null) {
    if (!list?.length) return;
    setError(null);
    try {
      const added: ManualFile[] = [];
      for (const [i, f] of [...list].entries()) {
        setBusy(`Uploading ${i + 1} of ${list.length}…`);
        added.push({ file: await uploadFile(f), name: f.name });
      }
      setFiles((cur) => [...cur, ...added]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    }
    setBusy(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy("Saving…"); setError(null);
    try {
      const res = await fetch("/api/manuals", {
        method: manual ? "PUT" : "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: manual?.id, title, category, notes, facts: facts.filter((f) => f.label.trim()), files }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onDone(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t save");
      setBusy(null);
    }
  }

  return (
    <Card className="mb-4 p-5">
      <form onSubmit={save} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
          <label className="block">
            <span className="mb-1 block text-[13px] font-medium">Title</span>
            <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Boiler: how to top up the pressure" required autoFocus />
          </label>
          <label className="block">
            <span className="mb-1 block text-[13px] font-medium">About</span>
            <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>
              {MANUAL_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-[13px] font-medium">Notes <span className="font-normal text-muted">(optional: steps, reminders)</span></span>
          <textarea className={`${inputCls} min-h-28`} value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder={"1. Check the pressure dial. It should sit between 1 and 1.5 bar.\n2. If it is low, open the silver loop slowly until it reaches 1.2 bar.\n3. Close it again."} />
        </label>
        <div>
          <span className="mb-1 block text-[13px] font-medium">Key details <span className="font-normal text-muted">(optional: prices, contract dates, wifi name and password…)</span></span>
          <div className="space-y-2">
            {facts.map((f, i) => (
              <div key={i} className="grid grid-cols-[1fr_1.4fr_auto_auto] items-center gap-2">
                <input className={inputCls} value={f.label} placeholder="Label" onChange={(e) => setFacts((c) => c.map((x, k) => k === i ? { ...x, label: e.target.value } : x))} />
                <input className={inputCls} value={f.value} placeholder="Value" onChange={(e) => setFacts((c) => c.map((x, k) => k === i ? { ...x, value: e.target.value } : x))} />
                <label className="flex items-center gap-1 whitespace-nowrap text-[12px] text-muted"><input type="checkbox" checked={!!f.secret} onChange={(e) => setFacts((c) => c.map((x, k) => k === i ? { ...x, secret: e.target.checked } : x))} />hide</label>
                <button type="button" onClick={() => setFacts((c) => c.filter((_, k) => k !== i))} className="text-muted hover:text-warn" aria-label="Remove detail">✕</button>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setFacts((c) => [...c, { label: "", value: "" }])} className="mt-2 text-[13px] text-accent">+ Add a detail</button>
        </div>
        <div>
          <span className="mb-1 block text-[13px] font-medium">Manuals and photos</span>
          {files.length > 0 && (
            <ul className="mb-2 space-y-1.5">
              {files.map((f) => (
                <li key={f.file} className="flex items-center justify-between gap-3 rounded-lg bg-sunken px-3 py-1.5 text-sm">
                  <span className="truncate">{isPdf(f.file) ? "📄" : "🖼️"} {f.name}</span>
                  <button type="button" onClick={() => setFiles((cur) => cur.filter((x) => x.file !== f.file))} className="shrink-0 text-muted hover:text-warn" aria-label={`Remove ${f.name}`}>✕</button>
                </li>
              ))}
            </ul>
          )}
          <label className={`inline-block cursor-pointer rounded-xl border border-dashed border-line px-4 py-3 text-sm text-muted hover:bg-sunken/60 ${busy ? "pointer-events-none opacity-60" : ""}`}>
            {busy?.startsWith("Uploading") ? busy : "+ Add PDFs or photos"}
            <input type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          </label>
        </div>
        {error && <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">{error}</p>}
        <div className="flex gap-2">
          <Button type="submit" disabled={!!busy || !title.trim()}>{busy === "Saving…" ? "Saving…" : manual ? "Save changes" : "Save"}</Button>
          <Button type="button" variant="ghost" onClick={() => onDone(null)}>Cancel</Button>
        </div>
      </form>
    </Card>
  );
}
