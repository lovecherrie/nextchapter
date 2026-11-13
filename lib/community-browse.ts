export const COMMUNITY_GENRES = {
  "Romance": /romance|romantic|love stories/i,
  "Mystery & Crime": /myster|detective|crime/i,
  "Thriller & Suspense": /thriller|suspense/i,
  "Fantasy": /fantasy|fantastic fiction/i,
  "Science Fiction": /science fiction|sci-fi/i,
  "Horror": /horror|ghost stories/i,
  "Humour": /humou?r|comedy|comedies|satire/i,
  "Historical Fiction": /historical fiction|historical romance/i,
  "Literary Fiction": /literary fiction|fiction.*literary/i,
  "Manga & Graphic Novels": /manga|manhwa|manhua|graphic novel|comics|comic book/i,
  "Biography & Memoir": /biograph|memoir/i,
  "Nonfiction": /non.?fiction|philosophy|psychology|self.help|business|economics|science|technology|management|politics|religion|health|travel|true crime/i,
} as const;

export function browseText(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}
export function bookTopicKey(book: { title: string; author: string | null }) {
  return JSON.stringify([browseText(book.title), browseText(book.author || "")]);
}
export function matchesCommunityGenre(genre: string, subjects: string[]) {
  const pattern = COMMUNITY_GENRES[genre as keyof typeof COMMUNITY_GENRES];
  return !!pattern && subjects.some((subject) => {
    if (genre === "Nonfiction" && !/non.?fiction/i.test(subject) && /fiction|novel|fantasy|manga|comic/i.test(subject)) return false;
    return pattern.test(subject);
  });
}

export type GenreBook = { title: string; author: string | null; book_genres?: { genres: string[] } | { genres: string[] }[] | null };
export function savedBookGenres(book: GenreBook): string[] {
  const rows = Array.isArray(book.book_genres) ? book.book_genres : book.book_genres ? [book.book_genres] : [];
  return [...new Set(rows.flatMap((row) => Array.isArray(row.genres) ? row.genres.filter((genre): genre is string => typeof genre === "string") : []))];
}
