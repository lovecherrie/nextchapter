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

  if (title === q) score += 10000;
  else if (title.startsWith(q)) score += 7000;
  else if (title.includes(q)) score += 3500;

  const queryWords = q.split(" ").filter(Boolean);
  const titleWords = title.split(" ").filter(Boolean);

  let matchedWords = 0;

  for (const queryWord of queryWords) {
    if (titleWords.some((titleWord) => titleWord.startsWith(queryWord))) {
      matchedWords += 1;
    }
  }

  if (queryWords.length > 0) {
    score += matchedWords * 600;

    if (matchedWords === queryWords.length) {
      score += 1200;
    }
  }

  if (author.includes(q)) score += 500;

  score += Math.min(book.popularity, 3000) / 50;

  if (book.source === "google") score += 100;

  score -= Math.max(0, title.length - q.length) * 0.2;

  return score;
}

async function fetchGoogleBooks(searchQuery: string): Promise<SearchBook[]> {
  try {
    const url =
      "https://www.googleapis.com/books/v1/volumes?" +
      new URLSearchParams({
        q: searchQuery,
        maxResults: "20",
        printType: "books",
        orderBy: "relevance",
      }).toString();

    const response = await fetch(url, {
      next: { revalidate: 1800 },
      signal: AbortSignal.timeout(3000),
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

async function searchGoogleBooks(query: string): Promise<SearchBook[]> {
  const [normalResults, titleResults] = await Promise.all([
    fetchGoogleBooks(query),
    fetchGoogleBooks(`intitle:${query}`),
  ]);

  return dedupeBooks([...normalResults, ...titleResults]);
}

async function searchOpenLibrary(query: string): Promise<SearchBook[]> {
  try {
    const url =
      "https://openlibrary.org/search.json?" +
      new URLSearchParams({
        title: query,
        limit: "15",
        fields:
          "key,title,author_name,cover_i,first_publish_year,edition_count",
      }).toString();

    const response = await fetch(url, {
      next: { revalidate: 1800 },
      signal: AbortSignal.timeout(2200),
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

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() || "";

  if (query.length < 2) {
    return NextResponse.json({ books: [] });
  }

  try {
    let books = await searchGoogleBooks(query);

    if (books.length < 8) {
      const openLibraryBooks = await searchOpenLibrary(query);
      books = dedupeBooks([...books, ...openLibraryBooks]);
    }

    const ranked = books
      .sort((a, b) => scoreBook(b, query) - scoreBook(a, query))
      .slice(0, 8);

    return NextResponse.json(
      {
        books: ranked.map(({ source, popularity, ...book }) => book),
      },
      {
        headers: {
          "Cache-Control":
            "public, s-maxage=300, stale-while-revalidate=1800",
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
