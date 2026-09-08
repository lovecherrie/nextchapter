import { NextRequest, NextResponse } from "next/server";

type SearchBook = {
  id: string;
  external_id: string;
  title: string;
  author: string;
  cover: string | null;
  cover_url: string | null;
  publishedDate: string | null;
  source: "google" | "openlibrary";
  popularity: number;
};

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function levenshtein(a: string, b: string) {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix = Array.from({ length: rows }, () =>
    Array<number>(cols).fill(0)
  );

  for (let i = 0; i < rows; i++) matrix[i][0] = i;
  for (let j = 0; j < cols; j++) matrix[0][j] = j;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
}

function scoreBook(book: SearchBook, query: string) {
  const title = normalizeText(book.title);
  const author = normalizeText(book.author);
  const q = normalizeText(query);

  if (!title || !q) return -9999;

  let score = 0;

  if (title === q) score += 10000;
  if (title.startsWith(q)) score += 7000;
  if (title.includes(q)) score += 4000;

  const qWords = q.split(" ").filter(Boolean);
  const titleWords = title.split(" ").filter(Boolean);

  let matchingWords = 0;
  for (const word of qWords) {
    if (titleWords.some((titleWord) => titleWord.startsWith(word))) {
      matchingWords += 1;
    }
  }

  score += matchingWords * 700;

  if (q.length >= 4) {
    const comparableTitle = title.slice(0, Math.min(title.length, q.length));
    const distance = levenshtein(q, comparableTitle);

    if (distance === 1) score += 2600;
    else if (distance === 2 && q.length >= 6) score += 1500;
  }

  if (author.includes(q)) score += 900;
  score += Math.min(book.popularity, 5000) / 50;
  if (book.source === "google") score += 50;
  score -= Math.max(0, title.length - q.length) * 0.6;

  return score;
}

function isRelevant(book: SearchBook, query: string) {
  const title = normalizeText(book.title);
  const q = normalizeText(query);

  if (!title || !q) return false;
  if (title.startsWith(q) || title.includes(q)) return true;

  const qWords = q.split(" ").filter(Boolean);
  const titleWords = title.split(" ").filter(Boolean);

  const matchingWords = qWords.filter((word) =>
    titleWords.some((titleWord) => titleWord.startsWith(word))
  ).length;

  if (matchingWords === qWords.length && qWords.length > 0) return true;

  if (q.length >= 4) {
    const comparableTitle = title.slice(0, Math.min(title.length, q.length));
    const distance = levenshtein(q, comparableTitle);

    if (distance <= 1) return true;
    if (q.length >= 7 && distance <= 2) return true;
  }

  return false;
}

function dedupeBooks(books: SearchBook[]) {
  const seen = new Set<string>();
  const result: SearchBook[] = [];

  for (const book of books) {
    const key = `${normalizeText(book.title)}|${normalizeText(book.author)}`;

    if (!seen.has(key)) {
      seen.add(key);
      result.push(book);
    }
  }

  return result;
}

async function searchGoogleBooks(query: string): Promise<SearchBook[]> {
  try {
    const url =
      "https://www.googleapis.com/books/v1/volumes?" +
      new URLSearchParams({
        q: query,
        maxResults: "20",
        printType: "books",
        orderBy: "relevance",
      }).toString();

    const response = await fetch(url, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(2500),
    });

    if (!response.ok) return [];

    const data = await response.json();

    return (data.items || [])
      .map((item: any): SearchBook | null => {
        const info = item.volumeInfo || {};
        const title = String(info.title || "").trim();
        if (!title) return null;

        const author =
          Array.isArray(info.authors) && info.authors.length > 0
            ? info.authors.join(", ")
            : "Unknown author";

        const rawCover =
          info.imageLinks?.thumbnail ||
          info.imageLinks?.smallThumbnail ||
          null;

        const cover = rawCover
          ? String(rawCover).replace(/^http:/, "https:")
          : null;

        return {
          id: `google-${item.id}`,
          external_id: `google-${item.id}`,
          title,
          author,
          cover,
          cover_url: cover,
          publishedDate: info.publishedDate || null,
          source: "google",
          popularity:
            Number(info.ratingsCount || 0) +
            Number(info.averageRating || 0) * 10,
        };
      })
      .filter(Boolean) as SearchBook[];
  } catch (error) {
    console.error("Google Books search failed:", error);
    return [];
  }
}

async function searchOpenLibrary(query: string): Promise<SearchBook[]> {
  try {
    const url =
      "https://openlibrary.org/search.json?" +
      new URLSearchParams({
        title: query,
        limit: "12",
        fields:
          "key,title,author_name,cover_i,first_publish_year,edition_count",
      }).toString();

    const response = await fetch(url, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(1800),
    });

    if (!response.ok) return [];

    const data = await response.json();

    return (data.docs || [])
      .map((doc: any): SearchBook | null => {
        const title = String(doc.title || "").trim();
        if (!title) return null;

        const author =
          Array.isArray(doc.author_name) && doc.author_name.length > 0
            ? doc.author_name.slice(0, 3).join(", ")
            : "Unknown author";

        const cover = doc.cover_i
          ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
          : null;

        const cleanKey = String(doc.key || "")
          .replace(/^\/works\//, "")
          .replace(/^\/books\//, "");

        if (!cleanKey) return null;

        return {
          id: `openlibrary-${cleanKey}`,
          external_id: `openlibrary-${cleanKey}`,
          title,
          author,
          cover,
          cover_url: cover,
          publishedDate: doc.first_publish_year
            ? String(doc.first_publish_year)
            : null,
          source: "openlibrary",
          popularity: Number(doc.edition_count || 0),
        };
      })
      .filter(Boolean) as SearchBook[];
  } catch (error) {
    console.error("Open Library search failed:", error);
    return [];
  }
}

function rankBooks(books: SearchBook[], query: string) {
  return dedupeBooks(books)
    .filter((book) => isRelevant(book, query))
    .sort((a, b) => scoreBook(b, query) - scoreBook(a, query));
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() || "";

  if (query.length < 2) {
    return NextResponse.json({ books: [] });
  }

  try {
    const googleBooks = await searchGoogleBooks(query);
    let ranked = rankBooks(googleBooks, query);

    if (ranked.length < 5) {
      const openLibraryBooks = await searchOpenLibrary(query);
      ranked = rankBooks([...googleBooks, ...openLibraryBooks], query);
    }

    return NextResponse.json(
      {
        books: ranked
          .slice(0, 8)
          .map(({ source, popularity, ...book }) => book),
      },
      {
        headers: {
          "Cache-Control":
            "public, s-maxage=300, stale-while-revalidate=3600",
        },
      }
    );
  } catch (error) {
    console.error("Book search route failed:", error);

    return NextResponse.json(
      { error: "Book search failed", books: [] },
      { status: 500 }
    );
  }
}
