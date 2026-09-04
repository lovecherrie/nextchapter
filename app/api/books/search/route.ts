export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q");

    if (!query || query.trim().length < 2) {
      return Response.json({ books: [] });
    }

    const encodedQuery = encodeURIComponent(query.trim());

    const response = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${encodedQuery}&maxResults=8`
    );

    if (!response.ok) {
      return Response.json(
        { error: "Book search failed" },
        { status: 500 }
      );
    }

    const data = await response.json();

    const books =
      data?.items?.map((item: any) => {
        const info = item?.volumeInfo || {};
        const imageLinks = info?.imageLinks || {};

        const cover =
          imageLinks?.thumbnail ||
          imageLinks?.smallThumbnail ||
          null;

        return {
          id: item.id,
          title: info.title || "Unknown title",
          author:
            info.authors?.join(", ") || "Unknown author",
          cover: cover
            ? cover.replace("http://", "https://")
            : null,
          publishedDate: info.publishedDate || null,
        };
      }) || [];

    return Response.json({ books });
  } catch (error) {
    console.error("Book search error:", error);

    return Response.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}