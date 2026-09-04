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

    // 2. FALLBACK: OPEN LIBRARY
    const openLibraryQuery = new URLSearchParams({
      title,
      author,
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
      readingStyle,
      avoid,
      extraNotes,
    } = body;

    const prompt = `
You are a highly selective personalized book recommendation engine.

Recommend exactly 5 real published books for this reader.

USER PROFILE

Books they liked:
${likedBooks || "Not provided"}

Books they disliked:
${dislikedBooks || "Not provided"}

Current mood:
${mood || "No preference"}

What matters most:
${matters?.join(", ") || "No preference"}

Preferred reading experience:
${readingStyle?.join(", ") || "No preference"}

Things to avoid:
${avoid?.join(", ") || "Nothing specified"}

Anything else the reader wants:
${extraNotes || "Nothing specified"}

HOW TO CHOOSE THE BOOKS

Before choosing the final recommendations, consider multiple candidate books and compare them against ALL of the user's inputs.

Prioritize the following:

1. Strongly avoid qualities that are likely related to books the reader disliked.
2. Understand what the reader may have enjoyed about the books they liked.
3. Match the reader's CURRENT mood.
4. Match the qualities they say matter most.
5. Match their preferred reading experience.
6. Respect everything in the avoid list.
7. Respect any specific requests in the extra notes.
8. Do not recommend a book simply because it is popular or because it belongs to the same broad genre.

ACCURACY VS VARIETY

Accuracy is more important than novelty.

It is completely acceptable for a commonly recommended book to appear if it is genuinely one of the strongest matches.

However:
- Do not lazily default to the same famous books for every reader.
- If the user's preferences change significantly, the recommendations should also change significantly.
- The 5 recommendations should not all be nearly identical.
- Try to provide some variety while keeping every recommendation strongly relevant.
- Do not force diversity if it would make the recommendations less accurate.

IMPORTANT

- Only recommend REAL published books.
- Do not recommend any book the reader already listed as liked or disliked.
- Think about the full combination of preferences, not just one keyword.
- If the user gives conflicting preferences, choose books that best balance those preferences.
- Keep each explanation specific and short.
- In each reason, mention the particular user preferences that made the book a good fit.
- Do not say generic things like "you may enjoy this because you like thrillers."

Return ONLY valid JSON in exactly this format:

{
  "recommendations": [
    {
      "title": "Book title",
      "author": "Author name",
      "reason": "Specific short explanation of why this book matches the reader"
    }
  ]
}

Return exactly 5 recommendations.
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

    let cleanedText = text.trim();

if (cleanedText.startsWith("```json")) {
  cleanedText = cleanedText
    .replace(/^```json/, "")
    .replace(/```$/, "")
    .trim();
}

if (cleanedText.startsWith("```")) {
  cleanedText = cleanedText
    .replace(/^```/, "")
    .replace(/```$/, "")
    .trim();
}

const parsed = JSON.parse(cleanedText);

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