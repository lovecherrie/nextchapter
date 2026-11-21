"use client";

import type { ImgHTMLAttributes } from "react";

// URL hints only; the browser owns image bytes and caching. Keep this bounded.
const loaded = new Set<string>();
function remember(src: string) {
  if (loaded.size >= 256 && !loaded.has(src)) loaded.delete(loaded.values().next().value!);
  loaded.add(src);
}
function forget(src: string) { loaded.delete(src); }

export default function StableImage({ src, alt = "", loading, decoding, onLoad, onError, ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  const known = typeof src === "string" && loaded.has(src);
  // A cover already seen in this tab should paint immediately on return,
  // without waiting for another lazy-loading/async-decoding cycle.
  // eslint-disable-next-line @next/next/no-img-element
  return <img {...props} src={src} alt={alt} loading={known ? "eager" : loading} decoding={known ? "sync" : decoding}
    onLoad={event => { if (typeof src === "string") remember(src); onLoad?.(event); }}
    onError={event => { if (typeof src === "string") forget(src); onError?.(event); }} />;
}
