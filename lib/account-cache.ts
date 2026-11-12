// Short-lived presentation data only. Database RLS still authorizes every request.
// Never persist this cache to browser storage or share it between server requests.
let account: string | null = null;
const entries = new Map<string, { value: unknown; until: number }>();

export function syncAccountCache(userId: string | null, invalidate = false) {
  if (typeof window === "undefined") return;
  if (account !== userId || invalidate || !userId) entries.clear();
  account = userId;
}

export function readAccountCache<T>(key: string): T | undefined {
  if (typeof window === "undefined" || !account) return;
  const entry = entries.get(key);
  if (!entry || entry.until <= Date.now()) { entries.delete(key); return; }
  return entry.value as T;
}

export function writeAccountCache(key: string, userId: string, value: unknown) {
  if (typeof window === "undefined" || account !== userId) return;
  if (entries.size >= 8 && !entries.has(key)) entries.delete(entries.keys().next().value!);
  entries.set(key, { value, until: Date.now() + 30000 });
}
