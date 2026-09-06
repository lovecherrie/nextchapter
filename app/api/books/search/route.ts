export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q");

    if (!query || query.trim().length < 2) {
      return Response.json({ books: [] });
    }

    const cleanQuery = query.trim();
    const normalizedQuery = normalize(cleanQuery);

    type BookResult = {
      id: string;
      title: string;
      author: string;
      cover: string | null;
      publishedDate: string | null;
    };

    function normalize(text: string) {
      return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    function levenshtein(a: string, b: string) {
      const matrix = Array.from(
        { length: b.length + 1 },
        () => Array(a.length + 1).fill(0)
      );

      for (let i = 0; i <= b.length; i++) {
        matrix[i][0] = i;
      }

      for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
      }

      for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
          if (b[i - 1] === a[j - 1]) {
            matrix[i][j] = matrix[i - 1][j - 1];
          } else {
            matrix[i][j] = Math.min(
              matrix[i - 1][j - 1] + 1,
              matrix[i][j - 1] + 1,
              matrix[i - 1][j] + 1
            );
          }
        }
      }

      return matrix[b.length][a.length];
    }

    function scoreBook(book: BookResult) {
      const title = normalize(book.title);
      const author = normalize(book.author);

      let score = 0;

      // -----------------------------
      // TITLE MATCHING
      // -----------------------------

      if (title === normalizedQuery) {
        score += 1000;
      }

      if (title.startsWith(normalizedQuery)) {
        score += 700;
      }

      if (title.includes(normalizedQuery)) {
        score += 400;
      }

      const queryWords = normalizedQuery.split(" ");
      const titleWords = title.split(" ");

      let matchingWords = 0;

      for (let i = 0; i < queryWords.length; i++) {
        if (
          titleWords[i] &&
          titleWords[i].startsWith(queryWords[i])
        ) {
          matchingWords++;
        }
      }

      score += matchingWords * 120;

      // -----------------------------
      // SMALL TYPO SUPPORT
      // -----------------------------

      const titleStart = title.slice(
        0,
        normalizedQuery.length
      );

      if (
        normalizedQuery.length >= 4 &&
        levenshtein(
          titleStart,
          normalizedQuery
        ) <= 2
      ) {
        score += 300;
      }

      // -----------------------------
      // AUTHOR MATCHING
      // -----------------------------

      if (author === normalizedQuery) {
        score += 900;
      }

      if (author.startsWith(normalizedQuery)) {
        score += 750;
      }

      if (author.includes(normalizedQuery)) {
        score += 600;
      }

      const authorWords = author.split(" ");

      let authorWordMatches = 0;

      for (const queryWord of queryWords) {
        if (
          authorWords.some((word) =>
            word.startsWith(queryWord)
          )
        ) {
          authorWordMatches++;
        }
      }

      if (
        authorWordMatches === queryWords.length &&
        queryWords.length > 1
      ) {
        score += 500;
      }

      return score;
    }

    function removeDuplicates(books: BookResult[]) {
      const seen = new Set<string>();

      return books.filter((book) => {
        const key = `${normalize(
          book.title
        )}-${normalize(book.author)}`;

        if (seen.has(key)) {
          return false;
        }

        seen.add(key);
        return true;
      });
    }

    // ---------------------------------
    // GOOGLE BOOKS
    // ---------------------------------

    async function searchGoogle(
      search: string
    ): Promise<BookResult[]> {
      try {
        const response = await fetch(
          `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(
            search
          )}&maxResults=40&printType=books`
        );

        if (!response.ok) {
          return [];
        }

        const data = await response.json();

        return (
          data?.items
            ?.map((item: any) => {
              const info =
                item?.volumeInfo || {};

              if (!info.title) {
                return null;
              }

              const imageLinks =
                info.imageLinks || {};

              const cover =
                imageLinks.thumbnail ||
                imageLinks.smallThumbnail ||
                null;

              return {
                id: `google-${item.id}`,
                title: info.title,
                author:
                  info.authors?.join(", ") ||
                  "Unknown author",
                cover: cover
                  ? cover.replace(
                      "http://",
                      "https://"
                    )
                  : null,
                publishedDate:
                  info.publishedDate || null,
              };
            })
            .filter(Boolean) || []
        );
      } catch {
        return [];
      }
    }

    // Search Google in several useful ways
    const [
      titleResults,
      authorResults,
      generalResults,
    ] = await Promise.all([
      searchGoogle(
        `intitle:${cleanQuery}`
      ),
      searchGoogle(
        `inauthor:${cleanQuery}`
      ),
      searchGoogle(cleanQuery),
    ]);

    let books = removeDuplicates([
      ...titleResults,
      ...authorResults,
      ...generalResults,
    ]);

    // ---------------------------------
    // OPEN LIBRARY BACKUP
    // ---------------------------------

    if (books.length < 8) {
      try {
        const params =
          new URLSearchParams({
            q: cleanQuery,
            limit: "40",
          });

        const response = await fetch(
          `https://openlibrary.org/search.json?${params.toString()}`
        );

        if (response.ok) {
          const data =
            await response.json();

          const openLibraryBooks =
            data?.docs
              ?.map((book: any) => {
                if (!book.title) {
                  return null;
                }

                const author =
                  book.author_name?.join(
                    ", "
                  ) || "Unknown author";

                return {
                  id: `openlibrary-${
                    book.key ||
                    `${book.title}-${author}`
                  }`,
                  title: book.title,
                  author,
                  cover: book.cover_i
                    ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`
                    : null,
                  publishedDate:
                    book.first_publish_year?.toString() ||
                    null,
                };
              })
              .filter(Boolean) || [];

          books = removeDuplicates([
            ...books,
            ...openLibraryBooks,
          ]);
        }
      } catch (error) {
        console.error(
          "Open Library search failed:",
          error
        );
      }
    }

    // ---------------------------------
    // SCORE RESULTS
    // ---------------------------------

    const scored = books
      .map((book) => ({
        book,
        score: scoreBook(book),
      }))
      .filter(
        (result) =>
          result.score >= 200
      )
      .sort(
        (a, b) =>
          b.score - a.score
      )
      .slice(0, 8)
      .map(
        (result) => result.book
      );

    return Response.json({
      books: scored,
    });
  } catch (error) {
    console.error(
      "Book search error:",
      error
    );

    return Response.json(
      {
        error:
          "Something went wrong",
      },
      {
        status: 500,
      }
    );
  }
}