"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { METER_TYPES, type MeterReading, type MeterType, type RoomPhoto } from "@/lib/types";
import { fileUrl, uploadFile } from "@/lib/upload";
import { Avatar } from "./People";
import { ScanViewer } from "./ScanViewer";
import { Button, Card } from "./ui";

type RoomRef = { id: string; name: string };

export function MoveIn({ rooms, photos, readings, houseScan }: { rooms: RoomRef[]; photos: RoomPhoto[]; readings: MeterReading[]; houseScan: string | null }) {
  return (
    <>
      <Meters readings={readings} />
      <BarePhotos rooms={rooms} photos={photos} />
      <HouseScan file={houseScan} />
    </>
  );
}

const today = () => new Date().toISOString().slice(0, 10);
const longDate = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
const input = "w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent";

// ── Meter readings ──────────────────────────────────────────────────

function Meters({ readings: initial }: { readings: MeterReading[] }) {
  const router = useRouter();
  const [readings, setReadings] = useState(initial);
  const [meter, setMeter] = useState<MeterType>("electric");
  const [label, setLabel] = useState("");
  const [reading, setReading] = useState("");
  const [unit, setUnit] = useState("kWh");
  const [takenOn, setTakenOn] = useState(today());
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoName, setPhotoName] = useState<string | null>(null); // stored name once uploaded
  const [reading_, setReadingState] = useState<string | null>(null); // status line from the photo read
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  useEffect(() => setReadings(initial), [initial]);
  useEffect(() => {
    if (!photo) return setPreview(null);
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  function pick(m: MeterType) {
    setMeter(m);
    setUnit(METER_TYPES.find((t) => t.value === m)!.unit);
  }

  /** Upload the photo straight away, then ask Gemini to read it. It only pre-fills the form. */
  async function choosePhoto(f: File | null) {
    setPhoto(f); setPhotoName(null); setReadingState(null); setError(null);
    if (!f) return;
    setReadingState("Uploading photo…");
    try {
      const name = await uploadFile(f);
      setPhotoName(name);
      setReadingState("Reading the dial…");
      const res = await fetch("/api/meters/read", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ file: name }) });
      const g = await res.json();
      if (!res.ok) throw new Error(g.error);
      if (g.kind === "electric" || g.kind === "gas") pick(g.kind);
      if (g.unit) setUnit(g.unit);
      if (g.reading) setReading(g.reading);
      if (g.serial && !label) setLabel(`Serial ${g.serial}`);
      setReadingState(g.reading
        ? `Gemini read ${g.reading}${g.unit ? " " + g.unit : ""} (${g.confidence} confidence). ${g.note} Check it against the dial before saving.`
        : `Couldn’t read the number${g.note ? `: ${g.note}` : ""}. Type it in by hand.`);
    } catch (err) {
      setReadingState(null);
      setError(err instanceof Error ? err.message : "Couldn’t read the photo. Type the number in by hand.");
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const file = photoName ?? (photo ? await uploadFile(photo) : null);
      const res = await fetch("/api/meters", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ meter, label, reading, unit, takenOn, notes, photo: file }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setReadings([data, ...readings]);
      setReading(""); setLabel(""); setNotes(""); setPhoto(null); setPhotoName(null); setReadingState(null); setAdding(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t save that reading");
    }
    setBusy(false);
  }

  async function remove(id: string) {
    setReadings((r) => r.filter((x) => x.id !== id));
    await fetch(`/api/meters/${id}`, { method: "DELETE" });
  }

  return (
    <section>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl">Meter readings</h2>
          <p className="text-sm text-muted">Add a photo of each dial too, so there’s proof if a bill is ever disputed.</p>
        </div>
        {!adding && <Button onClick={() => setAdding(true)}>+ Add reading</Button>}
      </div>

      {adding && (
        <Card className="mb-4 p-5">
          <form onSubmit={save} className="space-y-4">
            <div className="flex flex-wrap gap-1.5">
              {METER_TYPES.map((t) => (
                <button key={t.value} type="button" onClick={() => pick(t.value)}
                  className={`rounded-full border px-3.5 py-1.5 text-sm transition ${meter === t.value ? "border-accent bg-accent-soft font-medium text-accent" : "border-line text-muted hover:text-ink"}`}>
                  {t.label}
                </button>
              ))}
            </div>
            <div>
              <span className="mb-1 block text-[13px] font-medium">Photo of the meter <span className="font-normal text-muted">(Gemini reads it for you; you confirm)</span></span>
              {preview ? (
                <div className="relative w-48 overflow-hidden rounded-xl border border-line">
                  <img src={preview} alt="Meter" className="w-full" />
                  <button type="button" onClick={() => choosePhoto(null)} className="absolute right-2 top-2 rounded-full bg-ink/80 px-2.5 py-1 text-xs text-paper">Remove</button>
                </div>
              ) : (
                <label className="inline-block cursor-pointer rounded-xl border border-dashed border-line px-4 py-3 text-sm text-muted hover:bg-sunken/60">
                  Take a photo or choose one
                  <input type="file" accept="image/*" hidden onChange={(e) => choosePhoto(e.target.files?.[0] ?? null)} />
                </label>
              )}
              {reading_ && <p className="mt-2 rounded-lg bg-sunken px-3 py-2 text-[13px] text-muted">{reading_}</p>}
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_6rem_10rem]">
              <label className="block">
                <span className="mb-1 block text-[13px] font-medium">Reading</span>
                <input value={reading} onChange={(e) => setReading(e.target.value)} inputMode="decimal" placeholder="e.g. 12345.6" required className={`${input} tabular-nums`} />
              </label>
              <label className="block">
                <span className="mb-1 block text-[13px] font-medium">Unit</span>
                <input value={unit} onChange={(e) => setUnit(e.target.value)} className={input} />
              </label>
              <label className="block">
                <span className="mb-1 block text-[13px] font-medium">Date</span>
                <input type="date" value={takenOn} onChange={(e) => setTakenOn(e.target.value)} className={input} />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[13px] font-medium">Which meter? <span className="font-normal text-muted">(optional)</span></span>
                <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Night rate, hallway cupboard, serial number…" className={input} />
              </label>
              <label className="block">
                <span className="mb-1 block text-[13px] font-medium">Notes <span className="font-normal text-muted">(optional)</span></span>
                <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Dial was hard to read, prepay meter…" className={input} />
              </label>
            </div>
            {error && <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" disabled={busy || !reading.trim() || (reading_ ?? "").endsWith("…")}>{busy ? "Saving…" : "Save reading"}</Button>
              <Button type="button" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      {readings.length > 0 && <History readings={readings} />}

      {readings.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {readings.map((m) => (
            <article key={m.id} className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface">
              {m.photo && (
                <a href={fileUrl(m.photo)} target="_blank" rel="noopener noreferrer" className="block aspect-[16/9] bg-sunken">
                  <img src={fileUrl(m.photo)} alt={`${m.meter} meter`} loading="lazy" className="size-full object-cover" />
                </a>
              )}
              <div className="flex flex-1 flex-col p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-fit">
                  {METER_TYPES.find((t) => t.value === m.meter)?.label}{m.label && ` · ${m.label}`}
                </p>
                <p className="mt-1 font-display text-3xl tabular-nums">{m.reading} <span className="text-base text-muted">{m.unit}</span></p>
                {m.notes && <p className="mt-1 text-[13px] text-muted">{m.notes}</p>}
                <div className="mt-auto flex items-center justify-between gap-2 pt-3 text-[12px] text-muted">
                  <span className="flex items-center gap-1.5">{m.addedBy && <Avatar name={m.addedBy} size={20} />}{longDate(m.takenOn)}</span>
                  <button onClick={() => confirm("Delete this reading?") && remove(m.id)} className="text-faint hover:text-warn">Delete</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : !adding && (
        <button onClick={() => setAdding(true)} className="flex w-full flex-col items-center gap-1 rounded-2xl border-2 border-dashed border-line px-6 py-10 text-center hover:bg-surface">
          <span className="font-medium">No readings yet</span>
          <span className="text-sm text-muted">Electricity, gas and water, with a photo of each</span>
        </button>
      )}
    </section>
  );
}

// ── Bare-room photos ────────────────────────────────────────────────

function BarePhotos({ rooms, photos: initial }: { rooms: RoomRef[]; photos: RoomPhoto[] }) {
  const router = useRouter();
  const [photos, setPhotos] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<RoomPhoto | null>(null);
  useEffect(() => setPhotos(initial), [initial]);

  async function add(roomId: string, files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    try {
      const names: string[] = [];
      for (const [i, f] of [...files].entries()) {
        setBusy(`${roomId}:Uploading ${i + 1} of ${files.length}…`);
        names.push(await uploadFile(f));
      }
      const res = await fetch(`/api/rooms/${roomId}/photos`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ files: names, kind: "movein" }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPhotos([...data, ...photos]);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    }
    setBusy(null);
  }

  async function remove(id: string) {
    setPhotos((p) => p.filter((x) => x.id !== id));
    setOpen(null);
    await fetch(`/api/photos/${id}`, { method: "DELETE" });
  }

  return (
    <section>
      <div className="mb-4">
        <h2 className="font-display text-2xl">The empty rooms</h2>
        <p className="max-w-xl text-sm text-muted">
          Take each room bare, from the doorway and from the corners, in good light. A couple of wide shots per wall work best, with floor and skirting in view.
        </p>
      </div>
      {error && <p className="mb-3 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">{error}</p>}

      <div className="space-y-8">
        {rooms.map((room) => {
          const mine = photos.filter((p) => p.roomId === room.id);
          const status = busy?.startsWith(room.id + ":") ? busy.slice(room.id.length + 1) : null;
          return (
            <div key={room.id}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 className="font-display text-xl">{room.name} <span className="text-sm text-muted">{mine.length ? `· ${mine.length}` : ""}</span></h3>
                <label className={`cursor-pointer rounded-xl border border-line bg-surface px-3.5 py-2 text-sm font-medium transition hover:bg-sunken ${busy ? "pointer-events-none opacity-60" : ""}`}>
                  {status ?? "+ Add photos"}
                  <input type="file" accept="image/*" multiple hidden onChange={(e) => { add(room.id, e.target.files); e.target.value = ""; }} />
                </label>
              </div>
              {mine.length ? (
                <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0 [scrollbar-width:thin]">
                  {mine.map((p) => (
                    <button key={p.id} onClick={() => setOpen(p)} className="relative aspect-[4/3] w-60 shrink-0 snap-start overflow-hidden rounded-2xl bg-sunken sm:w-64">
                      <img src={fileUrl(p.file)} alt={`${room.name}, empty`} loading="lazy" className="size-full object-cover" />
                      {p.addedBy && <span className="absolute bottom-2 left-2"><Avatar name={p.addedBy} size={22} /></span>}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">No bare photos of the {room.name.toLowerCase()} yet</p>
              )}
            </div>
          );
        })}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/85 text-white" onClick={() => setOpen(null)}>
          <div className="flex items-center justify-between p-4 text-sm" onClick={(e) => e.stopPropagation()}>
            <span className="opacity-80">{rooms.find((r) => r.id === open.roomId)?.name} · {longDate(open.addedAt.slice(0, 10))}</span>
            <span className="flex gap-4">
              <a href={fileUrl(open.file)} download className="opacity-80 hover:opacity-100">Download</a>
              <button onClick={() => confirm("Delete this photo?") && remove(open.id)} className="opacity-80 hover:opacity-100">Delete</button>
              <button onClick={() => setOpen(null)} aria-label="Close">✕</button>
            </span>
          </div>
          <div className="grid min-h-0 flex-1 place-items-center p-4"><img src={fileUrl(open.file)} alt="" className="max-h-full max-w-full object-contain" /></div>
        </div>
      )}
    </section>
  );
}

// ── History: every reading over time, with usage since the one before ──

function History({ readings }: { readings: MeterReading[] }) {
  // One series per meter type + label, oldest first, so each row can show what was used since the last.
  const series = new Map<string, MeterReading[]>();
  for (const m of [...readings].sort((a, b) => a.takenOn.localeCompare(b.takenOn) || a.addedAt.localeCompare(b.addedAt))) {
    const key = `${m.meter}|${m.label}`;
    series.set(key, [...(series.get(key) ?? []), m]);
  }
  const multi = [...series.values()].filter((l) => l.length > 1);
  if (!multi.length) return (
    <p className="mb-4 rounded-xl bg-sunken px-4 py-3 text-[13px] text-muted">
      Add another reading later and this shows how much gas or electricity you’ve used between dates. All readings are saved in the house database, and you can <a href="/api/meters/export" className="text-accent underline underline-offset-2">download them as a CSV</a> any time.
    </p>
  );
  return (
    <div className="mb-4 space-y-3">
      {multi.map((list) => {
        const first = list[0];
        const t = METER_TYPES.find((x) => x.value === first.meter)!;
        return (
          <Card key={first.meter + first.label} className="overflow-x-auto p-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-fit">{t.label}{first.label && ` · ${first.label}`} · history</p>
            <table className="w-full text-sm tabular-nums">
              <thead><tr className="text-left text-[12px] text-muted"><th className="py-1 font-normal">Date</th><th className="font-normal">Reading</th><th className="font-normal">Used since last</th><th className="text-right font-normal">Per day</th></tr></thead>
              <tbody>
                {list.map((m, i) => {
                  const prev = list[i - 1];
                  const used = prev ? Number(m.reading) - Number(prev.reading) : null;
                  const days = prev ? Math.round((new Date(m.takenOn).getTime() - new Date(prev.takenOn).getTime()) / 86400000) : 0;
                  const ok = used != null && Number.isFinite(used);
                  return (
                    <tr key={m.id} className="border-t border-line">
                      <td className="py-1.5">{longDate(m.takenOn)}{i === 0 && <span className="ml-1.5 text-[11px] text-faint">start</span>}</td>
                      <td>{m.reading} {m.unit}</td>
                      <td className={ok && used < 0 ? "text-warn" : ""}>{ok ? `${Math.round(used * 10) / 10} ${m.unit}${used < 0 ? " (lower than before: check)" : ""}` : "–"}</td>
                      <td className="text-right text-muted">{ok && days > 0 && used >= 0 ? `${Math.round((used / days) * 10) / 10} ${m.unit}` : "–"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        );
      })}
      <p className="text-[13px] text-muted">Saved in the house database. <a href="/api/meters/export" className="text-accent underline underline-offset-2">Download all readings as CSV</a></p>
    </div>
  );
}

// ── Whole-house 3D scan ─────────────────────────────────────────────

function HouseScan({ file: initial }: { file: string | null }) {
  const router = useRouter();
  const [file, setFile] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setFile(initial), [initial]);

  async function replace(f: File | null) {
    if (!f) return;
    setBusy(true); setError(null);
    try {
      const name = await uploadFile(f);
      const res = await fetch("/api/house-scan", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ file: name }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFile(data.file);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    }
    setBusy(false);
  }

  async function remove() {
    setFile(null);
    await fetch("/api/house-scan", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ file: null }) });
    router.refresh();
  }

  return (
    <section>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl">Whole-house 3D scan</h2>
          <p className="text-sm text-muted">The LiDAR scan of the whole house on move-in day. Drag to look around.</p>
        </div>
        <label className={`cursor-pointer rounded-xl border border-line bg-surface px-3.5 py-2 text-sm font-medium transition hover:bg-sunken ${busy ? "pointer-events-none opacity-60" : ""}`}>
          {busy ? "Uploading…" : file ? "Replace scan" : "+ Upload scan"}
          <input type="file" accept=".glb,.gltf,.usdz,model/gltf-binary" hidden onChange={(e) => { replace(e.target.files?.[0] ?? null); e.target.value = ""; }} />
        </label>
      </div>
      {error && <p className="mb-3 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">{error}</p>}
      {file ? (
        <>
          <ScanViewer src={fileUrl(file)} />
          <p className="mt-2 flex gap-4 text-[13px] text-muted">
            <a href={fileUrl(file)} download className="text-accent underline underline-offset-2">Download</a>
            <button onClick={() => confirm("Remove the house scan?") && remove()} className="hover:text-warn">Remove</button>
          </p>
        </>
      ) : (
        <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">No house scan yet. Upload a GLB export from Polycam.</p>
      )}
    </section>
  );
}
