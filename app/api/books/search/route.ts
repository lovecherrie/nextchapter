import { NextRequest, NextResponse } from "next/server";

type SearchBook = {
  id: string;
  external_id: string;
  title: string;
  author: string;
  cover: string | null;
  cover_url: string | null;
  publishedDate: string | null;
  isbn10?: string | null;
  isbn13?: string | null;
  work_id?: string | null;
  edition_id?: string | null;
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

function scoreBook(book: SearchBook, query: string) {
  const title = normalizeText(book.title);
  const author = normalizeText(book.author);
  const q = normalizeText(query);

  if (!title || !q) return 0;

  let score = 0;

  // These are RANKING boosts only. Nothing is filtered out for not matching.
  if (title === q) score += 12000;
  if (title.startsWith(q)) score += 9000;
  if (title.includes(q)) score += 5500;

  const queryWords = q.split(" ").filter(Boolean);
  const titleWords = title.split(" ").filter(Boolean);

  let prefixMatches = 0;
  let looseMatches = 0;

  for (const queryWord of queryWords) {
    if (titleWords.some((titleWord) => titleWord.startsWith(queryWord))) {
      prefixMatches += 1;
    } else if (
      titleWords.some(
        (titleWord) =>
          titleWord.includes(queryWord) || queryWord.includes(titleWord)
      )
    ) {
      looseMatches += 1;
    }
  }

  score += prefixMatches * 1400;
  score += looseMatches * 500;

  if (queryWords.length && prefixMatches === queryWords.length) {
    score += 2500;
  }

  if (author.includes(q)) score += 800;

  // Light popularity boost only.
  score += Math.min(book.popularity, 5000) / 50;

  return score;
}

function mapGoogleBook(item: any): SearchBook | null {
  const info = item?.volumeInfo || {};
  const title = String(info.title || "").trim();

  if (!title) return null;

  const author =
    Array.isArray(info.authors) && info.authors.length > 0
      ? info.authors.join(", ")
      : "Unknown author";

  const rawCover =
    info.imageLinks?.extraLarge ||
    info.imageLinks?.large ||
    info.imageLinks?.medium ||
    info.imageLinks?.small ||
    info.imageLinks?.thumbnail ||
    info.imageLinks?.smallThumbnail ||
    null;

  const identifiers = Array.isArray(info.industryIdentifiers)
    ? info.industryIdentifiers
    : [];

  const isbn13 =
    identifiers.find((identifier: any) => identifier?.type === "ISBN_13")
      ?.identifier || null;

  const isbn10 =
    identifiers.find((identifier: any) => identifier?.type === "ISBN_10")
      ?.identifier || null;

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
    isbn10,
    isbn13,
    source: "google",
    popularity:
      Number(info.ratingsCount || 0) +
      Number(info.averageRating || 0) * 10,
  };
}

async function fetchGoogleBooks(searchQuery: string): Promise<SearchBook[]> {
  try {
    const url =
      "https://www.googleapis.com/books/v1/volumes?" +
      new URLSearchParams({
        q: searchQuery,
        maxResults: "40",
        printType: "books",
        orderBy: "relevance",
      }).toString();

    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(4500),
    });

    if (!response.ok) return [];

    const data = await response.json();

    return (data.items || [])
      .map(mapGoogleBook)
      .filter(Boolean) as SearchBook[];
  } catch (error) {
    console.error("Google Books search failed:", error);
    return [];
  }
}

async function searchGoogleBooks(query: string): Promise<SearchBook[]> {
  // Search BOTH broadly and by title.
  // The broad query prevents the autocomplete from becoming brittle.
  const [broad, titleFocused] = await Promise.all([
    fetchGoogleBooks(query),
    fetchGoogleBooks(`intitle:${query}`),
  ]);

  return dedupeBooks([...broad, ...titleFocused]);
}

async function searchOpenLibrary(query: string): Promise<SearchBook[]> {
  try {
    // IMPORTANT: use q= instead of title=.
    // q is intentionally broad. We rank title matches ourselves afterward.
    const url =
      "https://openlibrary.org/search.json?" +
      new URLSearchParams({
        q: query,
        limit: "40",
        fields:
          "key,title,author_name,cover_i,first_publish_year,edition_count,ratings_count,isbn,editions",
      }).toString();

    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(4500),
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
          ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg?default=false`
          : null;

        const isbns = Array.isArray(doc.isbn) ? doc.isbn : [];
        const isbn13 =
          isbns.find((value: string) => /^\d{13}$/.test(String(value))) || null;
        const isbn10 =
          isbns.find((value: string) => /^\d{10}$/.test(String(value))) || null;

        const bestEdition = doc.editions?.docs?.[0];
        const editionKey = String(bestEdition?.key || "")
          .replace(/^\/books\//, "") || null;

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
          isbn10,
          isbn13,
          work_id: cleanKey,
          edition_id: editionKey,
          source: "openlibrary",
          popularity:
            Number(doc.edition_count || 0) +
            Number(doc.ratings_count || 0),
        };
      })
      .filter(Boolean) as SearchBook[];
  } catch (error) {
    console.error("Open Library search failed:", error);
    return [];
  }
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() || "";

  // One character is too noisy, but "ro", "roc", "rock", etc. should search.
  if (query.length < 2) {
    return NextResponse.json({ books: [] });
  }

  try {
    // Always query BOTH sources.
    // Do not let one provider returning "enough" results stop the other one.
    const [googleBooks, openLibraryBooks] = await Promise.all([
      searchGoogleBooks(query),
      searchOpenLibrary(query),
    ]);

    const books = dedupeBooks([
      ...googleBooks,
      ...openLibraryBooks,
    ]);

    // NO strict relevance filter here.
    // Related results are allowed. Strong title matches simply rise to the top.
    const ranked = books
      .sort((a, b) => scoreBook(b, query) - scoreBook(a, query))
      .slice(0, 12);

    return NextResponse.json(
      {
        books: ranked.map(({ popularity, ...book }) => book),
      },
      {
        headers: {
          // Search suggestions change as the user types, so don't serve a stale
          // result list that can make suggestions appear and then disappear.
          "Cache-Control": "no-store",
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
