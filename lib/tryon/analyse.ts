import "server-only";
import { askJson } from "./gemini";
import type { ItemSpec } from "./types";

/**
 * Reads a photo or screenshot of a piece of furniture: what it is, its size (printed dimensions win over guesses),
 * its layout, and a list of concrete visual facts. Those facts go into every later prompt so Gemini draws this
 * product and not a similar one. People confirm or fix the size before anything is drawn.
 */
export async function analyseItem(photo: Buffer, hint = ""): Promise<ItemSpec> {
  const prompt = `This is a photo or a screenshot of one piece of furniture someone is thinking of buying${hint ? ` (they say: "${hint}")` : ""}. Ignore phone screen furniture (status bar, buttons, prices), people and other furniture around it.

Return JSON:
{
 "category": "sofa | sofa bed | corner sofa | chaise sofa | armchair | bed | wardrobe | chest of drawers | table | desk | bookcase | tv unit | other: say what",
 "width_cm": number, "depth_cm": number, "height_cm": number,
 "dims_source": "printed" if the numbers are written in the image (a diagram, a spec list), else "estimated",
 "dims_note": "which printed numbers you used and why, or how you estimated (e.g. 3 seats of about 60 cm)",
 "shape": "straight | corner-left | corner-right | chaise-left | chaise-right | box" (for sofas: corner = seats along both sides with a back on both; chaise = a long footrest seat with no back on that side; left/right as you face the front; "box" for anything that is not a seat),
 "seat_depth_cm": number or null (depth of the main seating run, for corner/chaise sofas),
 "return_width_cm": number or null (width of the corner/chaise part, for corner/chaise sofas),
 "seats_back": number or null (sofas: how many separate seat cushions along the main run, counting the corner seat),
 "seats_return": number or null (corner/chaise sofas: how many seat cushions on the return/chaise, not counting the corner seat),
 "layout": "short description of the layout with counts, e.g. '2 seats along the back plus a 2-seat return on the left; 2 arms'",
 "identity": ["8-14 short, concrete, checkable facts that make this exact product: the number of seat cushions and back cushions, arm shape and height, back style (channel stitching, buttons, loose cushions), leg type, material and colour, fabric texture, trims, piping, any built-in extras (tables, USB, lamp), scatter cushions"],
 "leave_out": "separate pieces sold with it (footstool, ottoman), people, pets, blankets, props in the photo, or 'none'",
 "mechanisms": "parts to show closed (pull-out bed, recliner, storage lid) or 'none'"
}
For an L-shaped sofa, width_cm is the long side and depth_cm the other side. If the image shows dimensions, use them exactly.`;
  const j = await askJson<any>(prompt, [photo]);
  const num = (v: unknown, d: number) => (typeof v === "number" && v > 0 ? v : Number(v) > 0 ? Number(v) : d);
  const shape = ["straight", "corner-left", "corner-right", "chaise-left", "chaise-right", "box"].includes(j.shape) ? j.shape : "straight";
  return {
    category: String(j.category || "sofa").replace(/^other:\s*/i, ""),
    widthCm: num(j.width_cm, 200), depthCm: num(j.depth_cm, 90), heightCm: num(j.height_cm, 85),
    dimsSource: j.dims_source === "printed" ? "printed" : "estimated",
    shape, photoShape: shape,
    seatDepthCm: j.seat_depth_cm ? num(j.seat_depth_cm, 90) : undefined,
    returnWidthCm: j.return_width_cm ? num(j.return_width_cm, 90) : undefined,
    seatsBack: Number(j.seats_back) > 0 ? Math.round(Number(j.seats_back)) : undefined,
    seatsReturn: Number(j.seats_return) > 0 ? Math.round(Number(j.seats_return)) : undefined,
    layout: String(j.layout || ""),
    identity: Array.isArray(j.identity) ? j.identity.map(String).slice(0, 16) : [],
    leaveOut: String(j.leave_out || "none"),
    mechanisms: String(j.mechanisms || "none"),
    notes: String(j.dims_note || ""),
  };
}
