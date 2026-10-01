import "server-only";
import { callGemini, extractGeminiText } from "./gemini";

/**
 * Reads a gas or electricity meter from a photo. This only pre-fills the form:
 * a person always checks the number against the dial before saving, because
 * a misread digit on a move-in reading is exactly what you don't want.
 */
export type MeterGuess = {
  kind: "electric" | "gas" | "other";
  reading: string; // digits as shown, "" if unreadable
  unit: string;
  serial: string;
  confidence: "high" | "medium" | "low";
  note: string;
};

const MODEL = process.env.GEMINI_SEARCH_MODEL || "gemini-3.5-flash";

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "reading", "unit", "serial", "confidence", "note"],
  properties: {
    kind: { type: "string", enum: ["electric", "gas", "other"] },
    reading: { type: "string", description: "The main register digits, left to right, with a decimal point only if the meter shows one. Empty string if you can't read it." },
    unit: { type: "string", description: "kWh for electricity; m³ for gas in metric (or hundreds of ft³ if the dial says so). Empty if unclear." },
    serial: { type: "string", description: "Meter serial number (S/N or MPAN/MPRN labels) if visible, else empty" },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    note: { type: "string", description: "One short sentence: e.g. 'Last digit is red (tenths), ignored', 'Two registers: this is the day rate', or why it couldn't be read" },
  },
} as const;

const SYSTEM =
  "You read UK domestic gas and electricity meters from photos. Report the cumulative register total shown in the main display. " +
  "Ignore red or boxed digits after the decimal point on old dial/digit meters (note that you did so). " +
  "If the meter has multiple registers (Day/Night, Economy 7) say which one you read in the note. " +
  "On smart meters showing several screens, read only the cumulative import kWh/m³ if it is on screen. " +
  "Never guess: if a digit isn't clearly legible, set confidence to low and explain in the note. Answer with the required JSON only.";

export async function readMeter(base64: string, mediaType: string): Promise<MeterGuess> {
  const data = await callGemini({
    model: MODEL,
    system_instruction: SYSTEM,
    input: [
      { type: "image", data: base64, mime_type: mediaType },
      { type: "text", text: "What does this meter read?" },
    ],
    response_format: { type: "text", mime_type: "application/json", schema: SCHEMA },
  });
  const text = extractGeminiText(data);
  if (!text.trim()) throw new Error("Gemini couldn't read that photo.");
  try {
    const g = JSON.parse(text) as MeterGuess;
    return { ...g, reading: String(g.reading ?? "").replace(/[^\d.]/g, "") };
  } catch {
    throw new Error("Gemini's answer wasn't readable. Type the number in by hand.");
  }
}
