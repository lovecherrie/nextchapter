// Only return to a page on this site, even if session storage was edited.
export function safeAuthReturn(value: string | null, origin: string) {
  if (!value) return "/profile";
  try {
    const target = new URL(value, origin);
    if (target.origin !== origin || target.pathname.replace(/\/+$/, "") === "/auth") return "/profile";
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return "/profile";
  }
}
