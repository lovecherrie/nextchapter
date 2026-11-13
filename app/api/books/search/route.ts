import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

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
  source: "google" | "openlibrary" | "cache";
  popularity: number;
};

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘]/g, "'")
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function dedupeBooks(books: SearchBook[]) {
  const seen = new Map<string, SearchBook>();
  const result: SearchBook[] = [];

  for (const book of books) {
    const key = `${normalizeText(book.title)}|${normalizeText(book.author)}`;

    if (!seen.has(key)) {
      seen.set(key, book);
      result.push(book);
    } else {
      // Keep the existing identity, but fill a missing cover from the same
      // title and author rather than discarding the provider's useful data.
      const existing = seen.get(key)!;
      if (!existing.cover_url && book.cover_url) {
        existing.cover = book.cover_url;
        existing.cover_url = book.cover_url;
      }
      existing.isbn13 ||= book.isbn13;
      existing.isbn10 ||= book.isbn10;
    }
  }

  return result;
}

function titleForComparison(value: string) {
  return normalizeText(value).replace(/^(the|an|a) /, "");
}

function editDistance(left: string, right: string) {
  const rows = Array.from({ length: left.length + 1 }, (_, i) =>
    Array.from({ length: right.length + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0)
  );
  for (let i = 1; i <= left.length; i++) {
    for (let j = 1; j <= right.length; j++) {
      rows[i][j] = Math.min(
        rows[i - 1][j] + 1,
        rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1)
      );
      if (i > 1 && j > 1 && left[i - 1] === right[j - 2] && left[i - 2] === right[j - 1]) {
        rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
      }
    }
  }
  return rows[left.length][right.length];
}

function closeTitleDistance(title: string, query: string) {
  const wanted = titleForComparison(query);
  const candidate = titleForComparison(title);
  if (wanted.length < 4 || wanted.length > 80) return null;
  const maximum = wanted.length >= 6 ? 2 : 1;
  if (Math.abs(candidate.length - wanted.length) > maximum) return null;
  const distance = editDistance(candidate, wanted);
  return distance > 0 && distance <= maximum && distance / Math.max(candidate.length, wanted.length) <= 0.3
    ? distance : null;
}

async function searchCloseTitles(query: string) {
  const word = titleForComparison(query).split(" ").find((part) => part.length >= 4);
  if (!word || query.length > 80) return [];
  // A bounded candidate lookup, followed by full-title comparison. Never
  // treat a shared word alone as evidence that a different title is a typo.
  const prefix = word.slice(0, 2);
  const cached = await searchCachedBooks(prefix);
  const candidates = cached.filter((book) => closeTitleDistance(book.title, query) !== null);
  if (candidates.length === 0) {
    const external = await searchOpenLibrary(`title:${prefix}*`, 60);
    candidates.push(...external.filter((book) => closeTitleDistance(book.title, query) !== null));
  }
  return dedupeBooks(candidates)
    .sort((a, b) => closeTitleDistance(a.title, query)! - closeTitleDistance(b.title, query)!)
    .slice(0, 5);
}

function scoreBook(book: SearchBook, query: string) {
  const title = normalizeText(book.title);
  const author = normalizeText(book.author);
  const q = normalizeText(query);

  if (!title || !q) return 0;

  let score = 0;

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

  if (author === q) score += 24000;
  else if (author.includes(q)) score += 18000;
  else if (queryWords.length >= 2 && queryWords.every((word) => author.split(" ").includes(word))) score += 16000;

  // Keep companion merchandise available for explicit searches, while giving
  // original works priority for general title/author searches. Children's
  // fiction, manga and illustrated editions are not penalized.
  const supplements = /\b(colou?ring|activity|workbook|workbooks|tracing|puzzle|puzzles|summary|summaries|study guide)\b/;
  if (supplements.test(title) && !supplements.test(q)) score -= 40000;

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
    : isbn13 || isbn10
      ? `https://covers.openlibrary.org/b/isbn/${isbn13 || isbn10}-L.jpg?default=false`
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

async function fetchGoogleBooks(
  searchQuery: string,
  onFailure: () => void = () => {}
): Promise<SearchBook[]> {
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
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) { onFailure(); return []; }

    const data = await response.json();

    return (data.items || [])
      .map(mapGoogleBook)
      .filter(Boolean) as SearchBook[];
  } catch (error) {
    onFailure();
    console.error("Google Books search failed:", error);
    return [];
  }
}

async function searchGoogleBooks(
  query: string,
  onFailure: () => void = () => {}
): Promise<SearchBook[]> {
  const [broad, titleFocused, authorFocused] = await Promise.all([
    fetchGoogleBooks(query, onFailure),
    fetchGoogleBooks(`intitle:${query}`, onFailure),
    fetchGoogleBooks(`inauthor:"${query.replace(/"/g, "")}"`, onFailure),
  ]);

  return dedupeBooks([...broad, ...titleFocused, ...authorFocused]);
}

async function searchOpenLibrary(
  query: string,
  limit = 20,
  onFailure: () => void = () => {}
): Promise<SearchBook[]> {
  try {
    const url =
      "https://openlibrary.org/search.json?" +
      new URLSearchParams({
        q: query,
        limit: String(limit),
        fields: limit > 20
          ? "key,title,author_name,cover_i,first_publish_year,edition_count,ratings_count"
          : "key,title,author_name,cover_i,first_publish_year,edition_count,ratings_count,isbn,editions",
      }).toString();

    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) { onFailure(); return []; }

    const data = await response.json();

    return (data.docs || [])
      .map((doc: any): SearchBook | null => {
        const title = String(doc.title || "").trim();

        if (!title) return null;

        const author =
          Array.isArray(doc.author_name) && doc.author_name.length > 0
            ? doc.author_name.slice(0, 3).join(", ")
            : "Unknown author";

        const isbns = Array.isArray(doc.isbn) ? doc.isbn : [];

        const isbn13 =
          isbns.find((value: string) =>
            /^\d{13}$/.test(String(value))
          ) || null;

        const isbn10 =
          isbns.find((value: string) =>
            /^\d{9}[\dX]$/i.test(String(value))
          ) || null;

        const cover = doc.cover_i
          ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg?default=false`
          : isbn13 || isbn10
            ? `https://covers.openlibrary.org/b/isbn/${isbn13 || isbn10}-L.jpg?default=false`
            : null;

        const bestEdition = doc.editions?.docs?.[0];

        const editionKey =
          String(bestEdition?.key || "").replace(/^\/books\//, "") ||
          null;

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
    onFailure();
    console.error("Open Library search failed:", error);
    return [];
  }
}

/*
|--------------------------------------------------------------------------
| AEPILOG BOOK CACHE
|--------------------------------------------------------------------------
*/

async function searchCachedBooks(
  query: string
): Promise<SearchBook[]> {
  try {
    const clean = query.trim();

    const [titleResult, authorResult] = await Promise.all([
      supabase
        .from("books")
        .select("id, external_id, title, author, cover_url")
        .ilike("title", `%${clean}%`)
        .abortSignal(AbortSignal.timeout(2500))
        .limit(20),

      supabase
        .from("books")
        .select("id, external_id, title, author, cover_url")
        .ilike("author", `%${clean}%`)
        .abortSignal(AbortSignal.timeout(2500))
        .limit(20),
    ]);

    if (titleResult.error) {
      console.error(
        "Cached title search failed:",
        titleResult.error
      );
    }

    if (authorResult.error) {
      console.error(
        "Cached author search failed:",
        authorResult.error
      );
    }

    const rows = [
      ...(titleResult.data || []),
      ...(authorResult.data || []),
    ];

    const books: SearchBook[] = rows.map((book: any) => ({
      id: book.external_id || book.id,
      external_id: book.external_id || String(book.id),
      title: book.title,
      author: book.author || "Unknown author",
      cover: book.cover_url || null,
      cover_url: book.cover_url || null,
      publishedDate: null,
      source: "cache",
      popularity: 0,
    }));

    return dedupeBooks(books);
  } catch (error) {
    console.error("Cached book search failed:", error);
    return [];
  }
}

async function saveBooksToCache(books: SearchBook[]) {
  try {
    const rows = books
      .filter(
        (book) =>
          book.external_id &&
          book.title &&
          book.source !== "cache"
      )
      .map((book) => ({
        external_id: book.external_id,
        title: book.title,
        author:
          book.author === "Unknown author"
            ? null
            : book.author,
        cover_url: book.cover_url || book.cover || null,
      }));

    if (rows.length === 0) return;

    const { error } = await supabase
      .from("books")
      .upsert(rows, {
        onConflict: "external_id",
        ignoreDuplicates: true,
      }).abortSignal(AbortSignal.timeout(1200));

    if (error) {
      console.error("Book cache save failed:", error);
    }
  } catch (error) {
    console.error("Book cache save failed:", error);
  }
}

/*
|--------------------------------------------------------------------------
| SEARCH ROUTE
|--------------------------------------------------------------------------
*/

// Cache complete merged results, never a partial database-only match or an empty failure.
const recentSearches = new Map<string, { expires: number; payload: { books: Omit<SearchBook, "popularity">[]; suggestions: Omit<SearchBook, "popularity">[] } }>();

export async function GET(request: NextRequest) {
  const query =
    request.nextUrl.searchParams.get("q")?.trim() || "";

  if (query.length < 2) {
    return NextResponse.json({ books: [] });
  }

  const key = query.toLowerCase().replace(/\s+/g, " ");
  const recent = recentSearches.get(key);
  if (recent && recent.expires > Date.now()) return NextResponse.json(recent.payload, { headers: { "Cache-Control": "no-store" } });

  try {
    // Search every source so a partial cached match cannot hide better results.
    // Each source handles failures independently, preserving cached results
    // when either external provider is unavailable.
    let googleFailures = 0;
    let openLibraryFailed = false;
    const [cachedBooks, googleBooks, openLibraryBooks] = await Promise.all([
      searchCachedBooks(query),
      searchGoogleBooks(query, () => { googleFailures++; }),
      searchOpenLibrary(query, 20, () => { openLibraryFailed = true; }),
    ]);

    const combinedBooks = dedupeBooks([
      ...cachedBooks,
      ...googleBooks,
      ...openLibraryBooks,
    ]);

    const ranked = combinedBooks
      .sort(
        (a, b) =>
          scoreBook(b, query) - scoreBook(a, query)
      )
      .slice(0, 12);

    const cleanQuery = normalizeText(query);
    const hasStrongMatch = combinedBooks.some((book) =>
      normalizeText(book.title).startsWith(cleanQuery) || normalizeText(book.author).includes(cleanQuery)
    );
    const suggestions = hasStrongMatch ? [] : await searchCloseTitles(query);

    if (!ranked.length && !suggestions.length && googleFailures === 3 && openLibraryFailed) {
      return NextResponse.json({ books: [], error: "Book search is temporarily unavailable. Please try again." }, { status: 503 });
    }

    /*
     * Save what we discovered so the next
     * person doesn't need the external search.
     */
    await saveBooksToCache(ranked);

    const payload = {
      books: ranked.map(({ popularity, ...book }) => book),
      suggestions: suggestions.map(({ popularity, ...book }) => book),
    };
    if (payload.books.length || payload.suggestions.length) {
      if (recentSearches.size >= 100) recentSearches.delete(recentSearches.keys().next().value!);
      recentSearches.set(key, { expires: Date.now() + 30000, payload });
    }
    return NextResponse.json(
      payload,
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Book search route failed:", error);

    return NextResponse.json(
      {
        error: "Book search failed",
        books: [],
      },
      {
        status: 500,
      }
    );
  }
}
