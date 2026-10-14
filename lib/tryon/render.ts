import "server-only";
import sharp from "sharp";
import { cropCamera, project, type Camera } from "./camera";
import { askJson, generateImage, HARMONISE_MODEL, imagePart, nearestRatio, PLATE_MODEL, readBox } from "./gemini";
import { blocksSvg, bounds, massing, type Placement } from "./massing";
import type { ItemSpec, RenderChecks } from "./types";

/**
 * Draws a real piece of furniture into a calibrated room photo at its real size. Image models redraw and resize
 * whatever they are given, so they are never trusted with geometry:
 *
 * 1. Pose guide (code): a grey block model of the item at its measured size and spot, drawn from the photo's camera.
 * 2. Product shot (Gemini): the exact product from the person's photo, re-angled to fill that block, on flat green.
 *    Checked against the block's silhouette; redrawn once if it does not fit.
 * 3. Placement (code): the green is keyed out and the cut-out pasted where the block is, with a contact shadow.
 * 4. Harmonise (Gemini): light, shadows and edges only, on a photo where the item is already in place.
 * 5. Guard (code): every pixel away from the item is copied back from the original photo, and the item's size in the
 *    final image is measured against the block.
 */
export type RenderInput = { room: Buffer; cam: Camera; product: Buffer; spec: ItemSpec; placement: Placement };
export type RenderOutput = { result: Buffer; plate: Buffer; guide: Buffer; checks: RenderChecks };

const sizeOf = (s: ItemSpec) => ({
  kind: s.category, width: s.widthCm / 100, depth: s.depthCm / 100, height: s.heightCm / 100, shape: s.shape,
  seatDepth: s.seatDepthCm ? s.seatDepthCm / 100 : undefined, returnWidth: s.returnWidthCm ? s.returnWidthCm / 100 : undefined,
  seats: s.seatsBack, seatsReturn: s.seatsReturn,
});

const none = (s: string) => !s || /^none\b/i.test(s.trim());

export async function renderTryOn({ room: roomIn, cam, product, spec, placement }: RenderInput): Promise<RenderOutput> {
  const room = await sharp(roomIn).rotate().resize(cam.W, cam.H, { fit: "fill" }).jpeg({ quality: 95 }).toBuffer();
  const { W, H } = cam;
  const blocks = massing(sizeOf(spec), placement);
  const b = bounds(cam, blocks);
  if (b.x1 < 0 || b.y1 < 0 || b.x0 > W || b.y0 > H) throw new Error("That spot is out of this photo. Move it to somewhere the photo shows.");

  // ── 1. pose guide, cropped around the item and padded to an aspect ratio Gemini can output
  let cw = (b.x1 - b.x0) * 1.08, ch = (b.y1 - b.y0) * 1.08;
  const ratio = nearestRatio(cw / ch), [ra, rb] = ratio.split(":").map(Number);
  if (cw / ch < ra / rb) cw = (ch * ra) / rb; else ch = (cw * rb) / ra;
  const crop = { left: (b.x0 + b.x1) / 2 - cw / 2, top: (b.y0 + b.y1) / 2 - ch / 2 };
  const GW = 1024, GH = Math.round((1024 * ch) / cw), k = GW / cw;
  const gcam = cropCamera(cam, crop.left, crop.top, k, GW, GH);
  const greenish = /green|olive|sage|teal|emerald|lime|mint/i.test(spec.identity.join(" ") + spec.category);
  const keyRgb = greenish ? [255, 0, 255] : [0, 255, 0], keyHex = greenish ? "#FF00FF" : "#00FF00";
  const guide = await sharp(Buffer.from(blocksSvg(gcam, blocks, { bg: keyHex }))).jpeg({ quality: 92 }).toBuffer();
  const guideMask = await sharp(Buffer.from(blocksSvg(gcam, blocks, { bg: "#000", mask: true }))).greyscale().raw().toBuffer();

  // ── 2. product shot, fitted to the block (one retry if the silhouette is off, keep the better one)
  const side = (sh?: string) => (sh?.endsWith("left") ? "left" : sh?.endsWith("right") ? "right" : null);
  const leave = [spec.leaveOut].filter((s) => !none(s)).join("; ");
  const platePrompt = `Image 1 shows a ${spec.category}. Image 2 is a grey 3D block model: the exact size, shape, position and viewing angle the ${spec.category} must have.

Draw the exact ${spec.category} from image 1 so that it fills the grey block in image 2 precisely: the same outline, the same viewing angle, the same place in the frame. Output the same framing as image 2.
- It must be the same product, not a similar one: ${spec.identity.join("; ")}.
- Layout: ${spec.layout || spec.shape}.${spec.seatsBack ? ` The grey block shows each seat cushion: exactly ${spec.seatsBack} seat cushion${spec.seatsBack > 1 ? "s" : ""} along the main run${spec.seatsReturn ? ` and ${spec.seatsReturn} on the ${spec.shape.startsWith("chaise") ? "chaise" : "return"}` : ""}, one per grey seat block.` : ""} Never add seats or sections to fill the space: make each one bigger instead.
- It is already the right way round in image 1 (${side(spec.shape) ? `its ${spec.shape.startsWith("chaise") ? "chaise" : "corner side"} is on the ${side(spec.shape)} as you face it` : "as shown"}): keep that, just turn it to the block's angle.
- Match the block's angle even if image 1 was photographed from another angle: turn the product in 3D to fit.
${leave ? `- Leave out: ${leave}. Show only the ${spec.category} itself.\n` : ""}- Show it as it normally stands, everything closed and folded away. No people, props, rugs, floor or shadow.
- Background: flat pure ${greenish ? "magenta #FF00FF" : "green #00FF00"} everywhere around it, perfectly even.`;
  // Stage A: a clean copy in the photo's own angle, with extra pieces gone and mechanisms closed. Re-angling a clean
  // single object (stage B) works far better than re-angling a busy listing photo.
  const closeUp = none(spec.mechanisms) ? "" : ` Close or fold away: ${spec.mechanisms.replace(/\b(extended|open(ed)?|pulled out|out)\b/gi, "").trim()}; show it as it normally stands.`;
  let clean = product;
  try {
    clean = await generateImage(HARMONISE_MODEL, [{ text: `Make a clean product photo of only the ${spec.category} in this image, from the same angle, on a plain white background.${leave ? ` Remove: ${leave}.` : ""}${closeUp} Keep everything about the ${spec.category} itself exactly the same: shape, number of seats and cushions, colour, fabric, arms, legs and extras. No text, no people, no other objects.` }, await imagePart(product, 1600)], nearestRatio(4 / 3), "1K");
  } catch { /* fall back to the original photo */ }
  // Gemini won't reliably mirror a product, so do it here: if it's wanted the other way round from the photo, flip it.
  const flip = side(spec.photoShape) && side(spec.shape) && side(spec.photoShape) !== side(spec.shape);
  if (flip) clean = await sharp(clean).flop().jpeg({ quality: 92 }).toBuffer();
  const productPart = await imagePart(clean, 1600), guidePart = await imagePart(guide);

  const N = GW * GH;
  async function makePlate() {
    const raw = await generateImage(PLATE_MODEL, [{ text: platePrompt }, productPart, guidePart], ratio, "1K");
    const px = await sharp(raw).resize(GW, GH, { fit: "fill" }).removeAlpha().raw().toBuffer();
    // key: flood fill from the border through key-coloured pixels, so key-ish colours inside the item survive
    const bg = new Uint8Array(N), stack: number[] = [];
    const near = (i: number) => Math.hypot(px[i * 3] - keyRgb[0], px[i * 3 + 1] - keyRgb[1], px[i * 3 + 2] - keyRgb[2]) < 150;
    for (let x = 0; x < GW; x++) stack.push(x, (GH - 1) * GW + x);
    for (let y = 0; y < GH; y++) stack.push(y * GW, y * GW + GW - 1);
    while (stack.length) {
      const i = stack.pop()!;
      if (bg[i] || !near(i)) continue;
      bg[i] = 1;
      const x = i % GW;
      if (x > 0) stack.push(i - 1); if (x < GW - 1) stack.push(i + 1); if (i >= GW) stack.push(i - GW); if (i < N - GW) stack.push(i + GW);
    }
    let inter = 0, union = 0;
    const rgba = Buffer.alloc(N * 4);
    for (let i = 0; i < N; i++) {
      const on = !bg[i], g = guideMask[i] > 127;
      if (on && g) inter++; if (on || g) union++;
      let r = px[i * 3], gg = px[i * 3 + 1], bb = px[i * 3 + 2];
      // despill: take the key colour's cast off the edges
      if (!greenish && gg > Math.max(r, bb)) gg = Math.max(r, bb);
      if (greenish && r > gg && bb > gg) { r = Math.min(r, gg + 20); bb = Math.min(bb, gg + 20); }
      rgba.set([r, gg, bb, on ? 255 : 0], i * 4);
    }
    return { raw, rgba, fit: union ? inter / union : 0 };
  }
  // a plate is good when it fills the block and has the right number of seats (Gemini likes to add sections)
  const wantSeats = (spec.seatsBack ?? 0) + (spec.seatsReturn ?? 0);
  const seatsOk = async (raw: Buffer) => {
    if (!wantSeats) return true;
    try {
      const j = await askJson<{ seat_cushions?: number }>(`How many separate seat cushions (the parts you sit on, not back cushions or scatter cushions) does this ${spec.category} have in total? JSON {"seat_cushions": number}`, [raw], { fast: true });
      return Math.round(Number(j.seat_cushions)) === wantSeats;
    } catch { return true; }
  };
  const score = async (p: Awaited<ReturnType<typeof makePlate>>) => p.fit + ((await seatsOk(p.raw)) ? 1 : 0);
  let plate = await makePlate(), best = await score(plate);
  for (let tries = 0; tries < 2 && best < 1.8; tries++) {
    const again = await makePlate().catch(() => null);
    if (!again) continue;
    const s2 = await score(again);
    if (s2 > best) { plate = again; best = s2; }
  }
  if (plate.fit < 0.5) throw new Error("Gemini could not draw this item in that position. Try a clearer photo of it, or check the shape and size.");

  // ── 3. paste where the block is, over a contact shadow drawn from the block's footprint
  const cut = await sharp(plate.rgba, { raw: { width: GW, height: GH, channels: 4 } })
    .resize(Math.round(cw), Math.round(ch)).png().toBuffer();
  const P = (p: [number, number, number]) => project(cam, p).slice(0, 2).map((v) => v.toFixed(1)).join(",");
  const feet = blocks.map((v) => `<polygon points="${v.slice(0, 4).map(P).join(" ")}" fill="rgba(25,18,10,0.6)"/>`).join("");
  const shadow = Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"><defs><filter id="b" x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation="${((b.y1 - b.y0) * 0.05).toFixed(1)}"/></filter></defs><g filter="url(#b)">${feet}</g></svg>`);
  // the cut-out may hang off the photo's edge: crop it to the frame before compositing
  const left = Math.round(crop.left), top = Math.round(crop.top);
  const vis = { left: Math.max(0, -left), top: Math.max(0, -top) };
  const visW = Math.min(Math.round(cw) - vis.left, W - Math.max(0, left)), visH = Math.min(Math.round(ch) - vis.top, H - Math.max(0, top));
  const cutVis = await sharp(cut).extract({ left: vis.left, top: vis.top, width: visW, height: visH }).png().toBuffer();
  const composite = await sharp(room).composite([{ input: shadow }, { input: cutVis, left: Math.max(0, left), top: Math.max(0, top) }]).jpeg({ quality: 93 }).toBuffer();

  // ── 4. harmonise light only
  const harmPrompt = `This photo is a real room with a ${spec.category} already placed in it. Its position, size and angle are measured and correct.
Make it look like a real photograph of the ${spec.category} in this room by changing light only:
- Match the ${spec.category}'s lighting, white balance, contrast and grain to the room.
- Make the contact shadows under it and any soft shadow on the wall behind it realistic.
- Blend its edges so it does not look cut out.
Do not move, resize, re-angle or redraw the ${spec.category}: every edge stays exactly where it is. Do not change its colour, fabric, stitching, cushions or legs.
Do not change anything else in the room, the framing or the crop.`;
  let harm: Buffer;
  try {
    const out = await generateImage(HARMONISE_MODEL, [{ text: harmPrompt }, await imagePart(composite)], nearestRatio(W / H), "2K");
    harm = await sharp(out).resize(W, H, { fit: "fill" }).removeAlpha().jpeg({ quality: 95 }).toBuffer();
  } catch {
    harm = composite; // the paste alone is still exact; it just looks a little flatter
  }

  // ── 5. guard: only a feathered zone around the item may differ from the original photo
  const bw = b.x1 - b.x0, bh = b.y1 - b.y0;
  const zone = [b.x0 - 0.1 * bw, b.y0 - 0.15 * bh, b.x1 + 0.1 * bw, b.y1 + 0.15 * bh].map((v, i) => Math.round(Math.max(0, Math.min(i % 2 ? H : W, v))));
  const f = Math.max(4, Math.round(Math.min(bw, bh) * 0.1));
  // the editable area is the item's own silhouette plus its floor shadow, grown and feathered a little
  const silhouette = await sharp(cutVis).extractChannel(3).toBuffer();
  const feetWhite = Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${blocks.map((v) => `<polygon points="${v.slice(0, 4).map(P).join(" ")}" fill="#fff"/>`).join("")}</svg>`);
  const hard = await sharp({ create: { width: W, height: H, channels: 3, background: "#000" } })
    .composite([{ input: feetWhite }, { input: await sharp(silhouette).toColourspace("b-w").png().toBuffer(), left: Math.max(0, left), top: Math.max(0, top), blend: "lighten" }])
    .greyscale().png().toBuffer();
  const mask = await sharp(hard).blur(f).linear(3, 0).greyscale().raw().toBuffer();
  const edited = await sharp(harm).removeAlpha().joinChannel(mask, { raw: { width: W, height: H, channels: 1 } }).png().toBuffer();
  const result = await sharp(room).composite([{ input: edited }]).jpeg({ quality: 92 }).toBuffer();

  // how far the harmoniser drifted the room outside the zone (0 = not at all; framing shifts show up as 10+)
  const small = (buf: Buffer) => sharp(buf).resize(200, 150, { fit: "fill" }).greyscale().raw().toBuffer();
  const [A, B] = await Promise.all([small(room), small(harm)]);
  let drift = 0, n = 0;
  for (let i = 0; i < A.length; i++) {
    const X = ((i % 200) / 200) * W, Y = (Math.floor(i / 200) / 150) * H;
    if (X > zone[0] && X < zone[2] && Y > zone[1] && Y < zone[3]) continue;
    drift += Math.abs(A[i] - B[i]); n++;
  }

  // measure the item in the final picture against the block
  let widthErrPct: number | null = null, heightErrPct: number | null = null;
  try {
    const box = readBox(await askJson(`Return JSON {"box_2d": [ymin, xmin, ymax, xmax]} (0-1000) tightly around the ${spec.category} in this photo, including its legs and arms, excluding shadows.`, [result]));
    if (box) {
      const [ymin, xmin, ymax, xmax] = box;
      // only judge the parts of the block that are inside the photo
      const vw = Math.min(b.x1, W) - Math.max(b.x0, 0), vh = Math.min(b.y1, H) - Math.max(b.y0, 0);
      widthErrPct = +((((xmax - xmin) / 1000) * W / vw - 1) * 100).toFixed(1);
      heightErrPct = +((((ymax - ymin) / 1000) * H / vh - 1) * 100).toFixed(1);
    }
  } catch { /* the picture is still right; we just could not double-check it */ }

  return {
    result, guide,
    plate: await sharp(plate.raw).jpeg({ quality: 88 }).toBuffer(),
    checks: { widthErrPct, heightErrPct, fitPct: Math.round(plate.fit * 100), roomShift: n ? +(drift / n).toFixed(1) : 0 },
  };
}
