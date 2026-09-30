import "server-only";
import crypto from "crypto";

const sid = () => process.env.TWILIO_ACCOUNT_SID!;
const token = () => process.env.TWILIO_AUTH_TOKEN!;
const basic = () => "Basic " + Buffer.from(`${sid()}:${token()}`).toString("base64");

/** https://www.twilio.com/docs/usage/security#validating-requests */
export function validSignature(url: string, params: Record<string, string>, signature: string | null) {
  if (!process.env.TWILIO_AUTH_TOKEN || !signature) return false;
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
  const expected = crypto.createHmac("sha1", token()).update(data).digest("base64");
  const a = Buffer.from(expected), b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function isAllowedSender(from: string) {
  const allowed = (process.env.ALLOWED_PHONE_NUMBERS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const bare = from.replace(/^whatsapp:/, "");
  return allowed.includes(bare);
}

/** MMS / WhatsApp media URLs require account auth to download. */
export async function fetchMedia(url: string) {
  const res = await fetch(url, { headers: { authorization: basic() } });
  if (!res.ok) throw new Error(`Twilio media ${res.status}`);
  return {
    base64: Buffer.from(await res.arrayBuffer()).toString("base64"),
    mediaType: res.headers.get("content-type") || "image/jpeg",
  };
}

export async function sendMessage(to: string, body: string, from?: string) {
  const sender = from ?? (to.startsWith("whatsapp:") ? `whatsapp:${process.env.TWILIO_FROM_NUMBER}` : process.env.TWILIO_FROM_NUMBER!);
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid()}/Messages.json`, {
    method: "POST",
    headers: { authorization: basic(), "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ To: to, From: sender, Body: body.slice(0, 1500) }),
  });
  if (!res.ok) console.error("[twilio] send failed", res.status, await res.text());
}

export const twiml = (message?: string) =>
  new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response>${message ? `<Message>${escapeXml(message)}</Message>` : ""}</Response>`,
    { headers: { "content-type": "text/xml" } },
  );

const escapeXml = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);
