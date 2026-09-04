async function getBookCover(title: string, author: string) {
  try {
    // 1. TRY GOOGLE BOOKS
    const googleQuery = encodeURIComponent(`${title} ${author}`);

    const googleResponse = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${googleQuery}&maxResults=5`
    );

    if (googleResponse.ok) {
      const googleData = await googleResponse.json();

      if (googleData?.items?.length) {
        for (const item of googleData.items) {
          const imageLinks = item?.volumeInfo?.imageLinks;

          const cover =
            imageLinks?.extraLarge ||
            imageLinks?.large ||
            imageLinks?.medium ||
            imageLinks?.small ||
            imageLinks?.thumbnail ||
            imageLinks?.smallThumbnail;

          if (cover) {
            return cover
              .replace("http://", "https://")
              .replace("&edge=curl", "");
          }
        }
      }
    }

    // 2. FALLBACK: OPEN LIBRARY SEARCH
    const openLibraryQuery = new URLSearchParams({
      title: title,
      author: author,
      limit: "5",
    });

    const openLibraryResponse = await fetch(
      `https://openlibrary.org/search.json?${openLibraryQuery.toString()}`
    );

    if (openLibraryResponse.ok) {
      const openLibraryData = await openLibraryResponse.json();

      const bookWithCover = openLibraryData?.docs?.find(
        (book: any) => book.cover_i
      );

      if (bookWithCover?.cover_i) {
        return `https://covers.openlibrary.org/b/id/${bookWithCover.cover_i}-L.jpg`;
      }
    }

    return null;
  } catch (error) {
    console.error("Book cover lookup failed:", error);
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      likedBooks,
      dislikedBooks,
      mood,
      matters,
      avoid,
    } = body;

    const prompt = `
Recommend exactly 5 real published books for this reader.

Books they liked:
${likedBooks || "Not provided"}

Books they disliked:
${dislikedBooks || "Not provided"}

Current mood:
${mood || "No preference"}

What matters most:
${matters?.join(", ") || "No preference"}

Avoid:
${avoid?.join(", ") || "Nothing specified"}

Return ONLY valid JSON in exactly this format:

{
  "recommendations": [
    {
      "title": "Book title",
      "author": "Author name",
      "reason": "Short explanation of why this book matches the reader"
    }
  ]
}

Rules:
- Return exactly 5 recommendations.
- Only recommend real published books.
- Do not recommend books the user listed as already liked or disliked.
- Keep each reason short.
`;

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "openai/gpt-oss-20b",
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
          response_format: {
            type: "json_object",
          },
          temperature: 0.7,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Groq error:", data);

      return Response.json(
        {
          error:
            data?.error?.message ||
            "Groq request failed",
        },
        {
          status: response.status,
        }
      );
    }

    const text = data.choices?.[0]?.message?.content;

    if (!text) {
      return Response.json(
        {
          error: "AI returned no response",
        },
        {
          status: 500,
        }
      );
    }

    const parsed = JSON.parse(text);

    if (
      !parsed.recommendations ||
      !Array.isArray(parsed.recommendations)
    ) {
      return Response.json(
        {
          error:
            "AI returned recommendations in the wrong format",
        },
        {
          status: 500,
        }
      );
    }

    const recommendationsWithCovers =
      await Promise.all(
        parsed.recommendations.map(
          async (book: {
            title: string;
            author: string;
            reason: string;
          }) => {
            const cover = await getBookCover(
              book.title,
              book.author
            );

            return {
              ...book,
              cover,
            };
          }
        )
      );

    return Response.json({
      recommendations: recommendationsWithCovers,
    });
  } catch (error: any) {
    console.error(
      "Recommendation error:",
      error
    );

    return Response.json(
      {
        error:
          error?.message ||
          "Something went wrong",
      },
      {
        status: 500,
      }
    );
  }
}