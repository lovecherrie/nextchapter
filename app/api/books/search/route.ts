export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q");

    if (!query || query.trim().length < 2) {
      return Response.json({ books: [] });
    }

    const cleanQuery = query.trim();

    // 1. TRY GOOGLE BOOKS FIRST
    try {
      const googleQuery = encodeURIComponent(cleanQuery);

      const googleResponse = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=${googleQuery}&maxResults=10&printType=books`
      );

      if (googleResponse.ok) {
        const googleData = await googleResponse.json();

        const googleBooks =
          googleData?.items
            ?.map((item: any) => {
              const info = item?.volumeInfo || {};
              const imageLinks = info?.imageLinks || {};

              const cover =
                imageLinks?.thumbnail ||
                imageLinks?.smallThumbnail ||
                null;

              return {
                id: `google-${item.id}`,
                title: info.title || null,
                author:
                  info.authors?.join(", ") ||
                  "Unknown author",
                cover: cover
                  ? cover.replace("http://", "https://")
                  : null,
                publishedDate:
                  info.publishedDate || null,
              };
            })
            .filter((book: any) => book.title) || [];

        if (googleBooks.length > 0) {
          return Response.json({
            books: googleBooks.slice(0, 8),
          });
        }
      }
    } catch (error) {
      console.error("Google Books search failed:", error);
    }

    // 2. FALLBACK TO OPEN LIBRARY
    try {
      const openLibraryParams = new URLSearchParams({
        q: cleanQuery,
        limit: "10",
      });

      const openLibraryResponse = await fetch(
        `https://openlibrary.org/search.json?${openLibraryParams.toString()}`
      );

      if (openLibraryResponse.ok) {
        const openLibraryData =
          await openLibraryResponse.json();

        const openLibraryBooks =
          openLibraryData?.docs
            ?.map((book: any) => {
              const author =
                book.author_name?.join(", ") ||
                "Unknown author";

              const cover = book.cover_i
                ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`
                : null;

              return {
                id: `openlibrary-${
                  book.key ||
                  `${book.title}-${author}`
                }`,
                title: book.title || null,
                author,
                cover,
                publishedDate:
                  book.first_publish_year?.toString() ||
                  null,
              };
            })
            .filter((book: any) => book.title) || [];

        return Response.json({
          books: openLibraryBooks.slice(0, 8),
        });
      }
    } catch (error) {
      console.error(
        "Open Library search failed:",
        error
      );
    }

    return Response.json({ books: [] });
  } catch (error) {
    console.error("Book search error:", error);

    return Response.json(
      {
        error: "Something went wrong",
      },
      {
        status: 500,
      }
    );
  }
}