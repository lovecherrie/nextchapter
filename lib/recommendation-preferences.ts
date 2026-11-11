export const BOOK_CATEGORIES = [
  "Literary Fiction", "Mystery & Crime", "Thriller & Suspense", "Romance",
  "Fantasy", "Science Fiction", "Horror", "Historical Fiction", "Adventure",
  "Humour", "Biography & Memoir", "Philosophy", "Psychology",
  "Self-Help & Personal Growth", "History", "Business & Economics",
  "Science & Technology", "Society & Culture", "Politics & Current Affairs",
  "Religion & Spirituality", "Health & Wellness", "True Crime",
  "Nature & Environment", "Travel", "Art & Creativity", "Manga & Graphic Novels", "Anything",
] as const;

export const MATTER_OPTIONS = [
  "Twists", "Characters", "Fast pace", "Beautiful writing", "Atmosphere",
  "Romance", "Suspense", "Emotional impact", "Big ideas", "New perspectives",
  "Human behaviour", "Practical advice", "Clear explanations", "Depth", "Strong arguments",
] as const;

const DEFAULT_ORDER = [
  "Characters", "Beautiful writing", "Atmosphere", "Emotional impact",
  "Big ideas", "New perspectives", "Clear explanations", "Practical advice",
];

const CATEGORY_PRIORITIES: Record<string, readonly string[]> = {
  "Literary Fiction": ["Beautiful writing", "Characters", "Depth", "Emotional impact", "New perspectives"],
  "Mystery & Crime": ["Twists", "Suspense", "Characters", "Fast pace", "Atmosphere"],
  "Thriller & Suspense": ["Suspense", "Twists", "Fast pace", "Characters", "Atmosphere"],
  "Romance": ["Romance", "Characters", "Emotional impact", "Beautiful writing", "Atmosphere"],
  "Fantasy": ["Atmosphere", "Characters", "Beautiful writing", "Emotional impact", "Big ideas"],
  "Science Fiction": ["Big ideas", "New perspectives", "Atmosphere", "Characters", "Depth"],
  "Horror": ["Atmosphere", "Suspense", "Twists", "Characters", "Emotional impact"],
  "Historical Fiction": ["Atmosphere", "Characters", "Beautiful writing", "New perspectives", "Emotional impact"],
  "Adventure": ["Fast pace", "Characters", "Atmosphere", "Suspense", "Twists"],
  "Humour": ["Characters", "Beautiful writing", "New perspectives", "Human behaviour", "Emotional impact"],
  "Biography & Memoir": ["Human behaviour", "New perspectives", "Emotional impact", "Beautiful writing", "Depth"],
  "Philosophy": ["Big ideas", "New perspectives", "Strong arguments", "Depth", "Clear explanations", "Beautiful writing", "Human behaviour", "Emotional impact"],
  "Psychology": ["Human behaviour", "New perspectives", "Clear explanations", "Practical advice", "Big ideas", "Depth", "Strong arguments", "Emotional impact"],
  "Self-Help & Personal Growth": ["Practical advice", "Clear explanations", "Human behaviour", "New perspectives", "Depth"],
  "History": ["New perspectives", "Clear explanations", "Depth", "Strong arguments", "Human behaviour"],
  "Business & Economics": ["Practical advice", "Big ideas", "Clear explanations", "Strong arguments", "Human behaviour"],
  "Science & Technology": ["Big ideas", "Clear explanations", "New perspectives", "Depth", "Strong arguments"],
  "Society & Culture": ["New perspectives", "Human behaviour", "Big ideas", "Strong arguments", "Depth"],
  "Politics & Current Affairs": ["Strong arguments", "New perspectives", "Clear explanations", "Depth", "Big ideas"],
  "Religion & Spirituality": ["Big ideas", "New perspectives", "Depth", "Practical advice", "Beautiful writing"],
  "Health & Wellness": ["Practical advice", "Clear explanations", "Strong arguments", "Human behaviour", "Depth"],
  "True Crime": ["Human behaviour", "Suspense", "Depth", "Clear explanations", "Atmosphere"],
  "Nature & Environment": ["New perspectives", "Beautiful writing", "Clear explanations", "Big ideas", "Atmosphere"],
  "Travel": ["Atmosphere", "New perspectives", "Beautiful writing", "Practical advice", "Human behaviour"],
  "Art & Creativity": ["New perspectives", "Practical advice", "Beautiful writing", "Big ideas", "Depth"],
  "Manga & Graphic Novels": ["Characters", "Emotional impact", "Fast pace", "Atmosphere", "Twists"],
};

const OLD_MATTERS: Record<string, string> = {
  "Plot twists": "Twists", "Strong characters": "Characters", "Fast pacing": "Fast pace",
};

export function normalizeCategories(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<string>(BOOK_CATEGORIES);
  const selected = [...new Set(value.filter((item): item is string => typeof item === "string" && allowed.has(item)))];
  return selected.includes("Anything") ? ["Anything"] : selected.slice(0, 3);
}

export function normalizeMatters(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<string>(MATTER_OPTIONS);
  return [...new Set(value
    .filter((item): item is string => typeof item === "string")
    .map((item) => OLD_MATTERS[item] || item)
    .filter((item) => allowed.has(item)))].slice(0, 3);
}

export function toggleCategory(current: string[], value: string): string[] {
  if (current.includes(value)) return current.filter((item) => item !== value);
  if (value === "Anything") return ["Anything"];
  const selected = current.filter((item) => item !== "Anything");
  return selected.length < 3 ? [...selected, value] : current;
}

export function preferenceOrder(categories: string[]): string[] {
  const groups = categories.map((category) => CATEGORY_PRIORITIES[category]).filter(Boolean);
  const relevant: string[] = [];
  // Alternate interests so Philosophy + Fantasy doesn't become an intersection
  // or allow the first selected category to hide the second one's preferences.
  for (let i = 0; i < 8; i++) {
    for (const group of groups) if (group[i]) relevant.push(group[i]);
  }
  return [...new Set([...relevant, ...DEFAULT_ORDER, ...MATTER_OPTIONS])];
}

export function visibleMatters(categories: string[], selected: string[], expanded: boolean): string[] {
  const ordered = preferenceOrder(categories);
  return expanded ? ordered : [...new Set([...ordered.slice(0, 8), ...selected])];
}

export function recommendationPreferencePrompt(categoryInput: unknown, matterInput: unknown) {
  const categories = normalizeCategories(categoryInput).filter((item) => item !== "Anything");
  const matters = normalizeMatters(matterInput);
  return `Reading interests (book categories):
${categories.length ? categories.join(", ") : "No category preference. Fiction and nonfiction are both welcome."}

What matters most:
${matters.length ? matters.join(", ") : "No preference"}

HOW TO USE THESE PREFERENCES
- Treat selected categories as interests, not an intersection. Books may match different selected interests across the five recommendations; do not require every book to fit every category.
- When several categories are selected, reflect the range where it fits the reader, rather than forcing an unlikely hybrid genre.
- Anything means no category preference, not a genre and not a request for arbitrary books. Use their other taste signals.
- Manga and graphic novels are valid reading recommendations. When that interest is selected, recommend published manga/graphic novels with the correct creator, not anime episodes, colouring books, or activity merchandise. For ongoing series, recommend the first volume unless the reader specifies where they are in the series.
- Philosophy, psychology, practical nonfiction, history, science, essays, memoir, and other nonfiction are fully valid recommendations. Do not assume every reader wants fiction.
- Apply the selected priorities to the kind of book: ideas, human behaviour, clear explanations, depth, practical usefulness, and the quality of arguments matter for nonfiction. Do not force plot twists, romance, or an ending onto nonfiction unless the reader's choices make those relevant.
- Explain recommendations using the reader's selected interests and priorities, not only broad genre similarity.`;
}
