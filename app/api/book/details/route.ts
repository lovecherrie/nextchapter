import { NextRequest, NextResponse } from "next/server";

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, " ")
    .trim();
}

function stripHtml(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function titleScore(candidate: string, wanted: string) {
  const a = normalize(candidate);
  const b = normalize(wanted);

  if (!a || !b) return 0;
  if (a === b) return 100;
  if (a.startsWith(b) || b.startsWith(a)) return 80;
  if (a.includes(b) || b.includes(a)) return 60;

  const aWords = new Set(a.split(" "));
  const bWords = b.split(" ");
  const shared = bWords.filter((word) => aWords.has(word)).length;

  return shared * 10;
}

function authorLooksCompatible(candidate: string, wanted: string) {
  const a = normalize(candidate);
  const b = normalize(wanted);

  if (!b) return true;
  if (!a) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;

  const aParts = a.split(" ");
  const bParts = b.split(" ");

  return bParts.some(
    (part) =>
      part.length > 2 &&
      aParts.includes(part)
  );
}

async function fetchWithTimeout(
  url: string,
  timeoutMs = 5000
) {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    // Bound the whole request, including a stalled response body.
    return await Promise.race([
      (async () => {
        const response = await fetch(url, {
          signal: controller.signal,
          next: { revalidate: 86400 },
        });
        const data = response.ok ? await response.json() : null;
        return { ok: response.ok, json: async () => data };
      })(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(new Error("Book metadata request timed out"));
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

async function getGoogleDetails(
  title: string,
  author: string
) {
  const query =
    author.trim()
      ? `intitle:${title} inauthor:${author}`
      : `intitle:${title}`;

  const url =
    "https://www.googleapis.com/books/v1/volumes?" +
    new URLSearchParams({
      q: query,
      maxResults: "10",
      printType: "books",
    }).toString();

  const response =
    await fetchWithTimeout(url);

  if (!response.ok) {
    return null;
  }

  const data =
    await response.json();

  const candidates =
    (data.items || [])
      .map((item: any) => {
        const info =
          item?.volumeInfo || {};

        const candidateAuthor =
          Array.isArray(
            info.authors
          )
            ? info.authors.join(", ")
            : "";

        return {
          info,
          candidateAuthor,
          compatible: authorLooksCompatible(candidateAuthor, author),
          score:
            titleScore(
              info.title || "",
              title
            ) +
            (authorLooksCompatible(
              candidateAuthor,
              author
            )
              ? 25
              : 0),
        };
      })
      .filter((candidate: { compatible: boolean }) => candidate.compatible)
      .sort(
        (a: any, b: any) =>
          b.score - a.score
      );

  const match =
    candidates[0];

  if (
    !match ||
    match.score < 85
  ) {
    return null;
  }

  const info =
    match.info;

  const rawDescription =
    typeof info.description ===
    "string"
      ? info.description
      : "";

  return {
    description:
      rawDescription
        ? stripHtml(
            rawDescription
          )
        : null,
    publishedDate:
      info.publishedDate ||
      null,
    pageCount:
      typeof info.pageCount ===
      "number"
        ? info.pageCount
        : null,
    categories:
      Array.isArray(
        info.categories
      )
        ? info.categories
            .slice(0, 4)
        : [],
    publisher:
      info.publisher ||
      null,
    cover:
      (
        info.imageLinks?.extraLarge ||
        info.imageLinks?.large ||
        info.imageLinks?.medium ||
        info.imageLinks?.small ||
        info.imageLinks?.thumbnail ||
        info.imageLinks?.smallThumbnail ||
        null
      )?.replace(/^http:/, "https:") || null,
    isbn13:
      (Array.isArray(info.industryIdentifiers)
        ? info.industryIdentifiers.find((item: any) => item?.type === "ISBN_13")?.identifier
        : null) || null,
    isbn10:
      (Array.isArray(info.industryIdentifiers)
        ? info.industryIdentifiers.find((item: any) => item?.type === "ISBN_10")?.identifier
        : null) || null,
  };
}

async function getOpenLibraryDetails(
  title: string,
  author: string,
  topicsOnly = false
) {
  const searchUrl =
    "https://openlibrary.org/search.json?" +
    new URLSearchParams({
      title,
      author,
      limit: "10",
      fields:
        "key,title,author_name,cover_i,isbn,edition_key,editions,first_publish_year,number_of_pages_median,subject",
    }).toString();

  const searchResponse =
    await fetchWithTimeout(
      searchUrl
    );

  if (!searchResponse.ok) {
    return null;
  }

  const searchData =
    await searchResponse.json();

  const docs =
    (searchData.docs || [])
      .map((doc: any) => {
        const candidateAuthor =
          Array.isArray(
            doc.author_name
          )
            ? doc.author_name.join(
                ", "
              )
            : "";

        return {
          doc,
          compatible: authorLooksCompatible(candidateAuthor, author),
          score:
            titleScore(
              doc.title || "",
              title
            ) +
            (authorLooksCompatible(
              candidateAuthor,
              author
            )
              ? 25
              : 0),
        };
      })
      .filter((candidate: { compatible: boolean }) => candidate.compatible)
      .sort(
        (a: any, b: any) =>
          b.score - a.score
      );

  const match =
    docs[0];

  if (
    !match ||
    match.score < 85
  ) {
    return null;
  }

  const doc =
    match.doc;

  if (topicsOnly && (titleScore(doc.title || "", title) < 60 || !authorLooksCompatible((doc.author_name || []).join(", "), author))) return null;

  let description:
    string | null = null;

  if (
    !topicsOnly &&
    typeof doc.key === "string" &&
    doc.key.startsWith(
      "/works/"
    )
  ) {
    try {
      const workResponse =
        await fetchWithTimeout(
          `https://openlibrary.org${doc.key}.json`, 2500
        );

      if (
        workResponse.ok
      ) {
        const work =
          await workResponse.json();

        if (
          typeof work.description ===
          "string"
        ) {
          description =
            work.description.trim();
        } else if (
          work.description &&
          typeof work.description
            .value === "string"
        ) {
          description =
            work.description.value.trim();
        }
      }
    } catch {
      // Search metadata below is still useful.
    }
  }

  // Some books describe an edition rather than the parent work.
  let edition: { publish_date?: string; number_of_pages?: number; publishers?: string[] } | null = null;
  const editionId = Array.isArray(doc.edition_key)
    ? doc.edition_key.find((id: unknown) => typeof id === "string" && /^OL\d+M$/.test(id))
    : null;
  if (!topicsOnly && !description && editionId) {
    try {
      const response = await fetchWithTimeout(`https://openlibrary.org/books/${editionId}.json`, 2500);
      if (response.ok) {
        const candidate = await response.json();
        if (titleScore(candidate.title || "", title) >= 60) {
          edition = candidate;
          const raw = typeof candidate.description === "string" ? candidate.description : candidate.description?.value;
          if (typeof raw === "string") description = stripHtml(raw) || null;
        }
      }
    } catch {
      // Preserve the matched work's metadata when an edition is unavailable.
    }
  }

  return {
    description,
    publishedDate:
      edition?.publish_date || doc.first_publish_year
        ? String(
            edition?.publish_date || doc.first_publish_year
          )
        : null,
    pageCount:
      typeof (edition?.number_of_pages ?? doc.number_of_pages_median) ===
      "number"
        ? (edition?.number_of_pages ?? doc.number_of_pages_median)
        : null,
    categories:
      Array.isArray(doc.subject)
        ? doc.subject.slice(0, topicsOnly ? 80 : 4)
        : [],
    publisher: Array.isArray(edition?.publishers) ? edition.publishers.filter((value: unknown) => typeof value === "string").join(", ") || null : null,
    cover:
      doc.cover_i
        ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg?default=false`
        : null,
    isbn13:
      Array.isArray(doc.isbn)
        ? doc.isbn.find((value: string) => /^\d{13}$/.test(String(value))) || null
        : null,
    isbn10:
      Array.isArray(doc.isbn)
        ? doc.isbn.find((value: string) => /^\d{9}[\dX]$/.test(String(value))) || null
        : null,
    workId:
      typeof doc.key === "string"
        ? doc.key.replace(/^\/works\//, "")
        : null,
  };
}

export async function GET(
  request: NextRequest
) {
  const topicsOnly = request.nextUrl.searchParams.get("topics") === "1";
  const title =
    request.nextUrl.searchParams
      .get("title")
      ?.trim() || "";

  const author =
    request.nextUrl.searchParams
      .get("author")
      ?.trim() || "";

  if (!title) {
    return NextResponse.json(
      {
        error:
          "A book title is required.",
      },
      { status: 400 }
    );
  }

  try {
    const [
      googleResult,
      openLibraryResult,
    ] =
      await Promise.allSettled([
        getGoogleDetails(
          title,
          author
        ),
        getOpenLibraryDetails(
          title,
          author,
          topicsOnly
        ),
      ]);

    const google =
      googleResult.status ===
      "fulfilled"
        ? googleResult.value
        : null;

    const openLibrary =
      openLibraryResult.status ===
      "fulfilled"
        ? openLibraryResult.value
        : null;

    if (topicsOnly) {
      if (!google && !openLibrary) return NextResponse.json({ error: "Book genres unavailable" }, { status: 503 });
      return NextResponse.json({ categories: [...new Set([...(google?.categories || []), ...(openLibrary?.categories || [])].filter((value): value is string => typeof value === "string"))] }, { headers: { "Cache-Control": "public, max-age=3600" } });
    }

    const description =
      google?.description ||
      openLibrary?.description ||
      null;

    return NextResponse.json({
      description,
      cover: google?.cover || openLibrary?.cover || null,
      publishedDate:
        google?.publishedDate ||
        openLibrary?.publishedDate ||
        null,
      pageCount:
        google?.pageCount ||
        openLibrary?.pageCount ||
        null,
      categories:
        google?.categories?.length
          ? google.categories
          : openLibrary?.categories ||
            [],
      publisher:
        google?.publisher ||
        openLibrary?.publisher ||
        null,
    }, { headers: { "Cache-Control": google || openLibrary ? "public, max-age=3600, stale-while-revalidate=86400" : "no-store" } });
  } catch (error) {
    console.error(
      "Book details error:",
      error
    );

    return NextResponse.json(
      {
        description: null,
        publishedDate: null,
        pageCount: null,
        categories: [],
        publisher: null,
      },
      { status: 200 }
    );
  }
}
