export type CatalogueBook = {
  id?: string;
  external_id?: string;
  title: string;
  author?: string | null;
  cover?: string | null;
  cover_url?: string | null;
  publishedDate?: string | null;
  isbn10?: string | null;
  isbn13?: string | null;
};
export type CatalogueResults = { books: CatalogueBook[]; suggestions: CatalogueBook[] };

// Public catalogue results only. Memory in this tab, never server or storage.
const results = new Map<string, { value: CatalogueResults; until: number }>();
const key = (query: string) => query.trim().toLowerCase();

export function cachedBookSearch(query: string): CatalogueResults | undefined {
  if (typeof window === "undefined") return;
  const entry = results.get(key(query));
  if (!entry || entry.until <= Date.now()) { results.delete(key(query)); return; }
  return entry.value;
}

export function rememberBookSearch(query: string, value: CatalogueResults) {
  if (typeof window === "undefined" || !value.books.length && !value.suggestions.length) return;
  const normalized = key(query);
  results.delete(normalized);
  if (results.size >= 12) results.delete(results.keys().next().value!);
  results.set(normalized, { value, until: Date.now() + 120000 });
}
