import { safeCoverUrl } from "@/lib/share-card";

export async function GET(request: Request) {
  const url = safeCoverUrl(new URL(request.url).searchParams.get("url"));
  if (!url) return new Response("Unsupported cover", { status: 400 });
  try {
    // Only known cover endpoints; redirects may not escape the allowlist.
    const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(3500) });
    const type = response.headers.get("content-type")?.split(";")[0];
    if (!response.ok || !["image/jpeg", "image/png", "image/webp"].includes(type || "") || !response.body) throw new Error("Cover unavailable");
    const limit = 2 * 1024 * 1024;
    if (Number(response.headers.get("content-length")) > limit) { await response.body.cancel(); throw new Error("Cover too large"); }
    const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new Error("Cover too large"); }
      chunks.push(value);
    }
    return new Response(new Blob(chunks as BlobPart[], { type: type! }), { headers: { "Content-Type": type!, "Cache-Control": "public, max-age=86400", "X-Content-Type-Options": "nosniff" } });
  } catch { return new Response("Cover unavailable", { status: 404 }); }
}
