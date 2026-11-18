import { createHash, randomBytes } from "node:crypto";
import { supabase } from "@/lib/supabase";

export class ApiInputError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
const salt = randomBytes(16).toString("hex");
const windows = new Map<string, { until: number; count: number }>();

// A local per-client brake complements the shared database AI quota.
// This map is bounded, short-lived, and stores a salted hash rather than raw IPs.
export function requestLimit(request: Request, kind: "recommend" | "catalogue") {
  const now = Date.now();
  const address = (request.headers?.get("x-vercel-forwarded-for") || request.headers?.get("x-forwarded-for") || "unknown").split(",")[0].trim().slice(0, 80);
  const key = createHash("sha256").update(`${salt}:${kind}:${address}`).digest("hex");
  if (windows.size >= 10000) {
    for (const [id, entry] of windows) if (entry.until <= now) windows.delete(id);
    if (windows.size >= 10000 && !windows.has(key)) return Response.json({ error: "Please wait a moment and try again." }, { status: 429, headers: { "Retry-After": "60" } });
  }
  let entry = windows.get(key);
  if (!entry || entry.until <= now) { entry = { until: now + 60000, count: 0 }; windows.set(key, entry); }
  if (++entry.count > (kind === "recommend" ? 8 : 120)) return Response.json({ error: "Too many requests. Please wait a minute and try again." }, { status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil((entry.until - now) / 1000))) } });
  return null;
}

export async function readRecommendationInput(request: Request): Promise<Record<string, unknown>> {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw new ApiInputError("This request must come from aepilog.", 403);
  const maximum = 32768;
  if (Number(request.headers.get("content-length")) > maximum) throw new ApiInputError("This request is too large.", 413);
  if (!request.body) throw new ApiInputError("Please provide your reading preferences.");
  const reader = request.body.getReader();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const value = await Promise.race([
      (async () => {
        const chunks: Uint8Array[] = []; let size = 0;
        while (true) {
          const part = await reader.read(); if (part.done) break;
          size += part.value.byteLength;
          if (size > maximum) { void reader.cancel().catch(() => {}); throw new ApiInputError("This request is too large.", 413); }
          chunks.push(part.value);
        }
        const bytes = new Uint8Array(size); let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
        try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new ApiInputError("Please send valid reading preferences."); }
      })(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => { void reader.cancel().catch(() => {}); reject(new ApiInputError("Request timed out. Please try again.", 408)); }, 5000); }),
    ]);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new ApiInputError("Invalid reading preferences.");
    for (const [key, limit] of [["likedBooks", 4000], ["dislikedBooks", 4000], ["extraNotes", 1000], ["mood", 120]] as const) {
      if (value[key] !== undefined && (typeof value[key] !== "string" || value[key].length > limit)) throw new ApiInputError("Some reading preferences are too long or invalid.");
    }
    for (const [key, limit] of [["categories", 3], ["matters", 3], ["readingStyle", 2], ["avoid", 20], ["previousRecommendations", 200]] as const) {
      if (value[key] !== undefined && (!Array.isArray(value[key]) || value[key].length > limit || value[key].some((item: unknown) => typeof item !== "string" || item.length > 250))) throw new ApiInputError("Some reading preferences are too long or invalid.");
    }
    return value;
  } finally { clearTimeout(timer); }
}

export async function reserveAiRequest() {
  try {
    const { data, error } = await supabase.rpc("consume_ai_budget").abortSignal(AbortSignal.timeout(3000));
    if (error) return Response.json({ error: "Recommendations are temporarily unavailable. Please try again shortly." }, { status: 503 });
    if (data !== true) return Response.json({ error: "Recommendations are busy right now. Please try again later." }, { status: 429, headers: { "Retry-After": "60" } });
    return null;
  } catch { return Response.json({ error: "Recommendations are temporarily unavailable. Please try again shortly." }, { status: 503 }); }
}
