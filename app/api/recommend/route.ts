import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type Recommendation = {
  title: string;
  author: string;
  reason: string;
};

function normalizeBookName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

async function getBookCover(
  title: string,
  author: string
) {
  try {
    // 1. GOOGLE BOOKS
    const googleQuery = encodeURIComponent(
      `${title} ${author}`
    );

    const googleResponse = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${googleQuery}&maxResults=5`
    );

    if (googleResponse.ok) {
      const googleData =
        await googleResponse.json();

      if (googleData?.items?.length) {
        for (const item of googleData.items) {
          const imageLinks =
            item?.volumeInfo?.imageLinks;

          const cover =
            imageLinks?.extraLarge ||
            imageLinks?.large ||
            imageLinks?.medium ||
            imageLinks?.small ||
            imageLinks?.thumbnail ||
            imageLinks?.smallThumbnail;

          if (cover) {
            return cover
              .replace(
                "http://",
                "https://"
              )
              .replace(
                "&edge=curl",
                ""
              );
          }
        }
      }
    }

    // 2. OPEN LIBRARY FALLBACK
    const openLibraryQuery =
      new URLSearchParams({
        title,
        author,
        limit: "5",
      });

    const openLibraryResponse =
      await fetch(
        `https://openlibrary.org/search.json?${openLibraryQuery.toString()}`
      );

    if (openLibraryResponse.ok) {
      const openLibraryData =
        await openLibraryResponse.json();

      const bookWithCover =
        openLibraryData?.docs?.find(
          (book: any) => book.cover_i
        );

      if (bookWithCover?.cover_i) {
        return `https://covers.openlibrary.org/b/id/${bookWithCover.cover_i}-L.jpg`;
      }
    }

    return null;
  } catch (error) {
    console.error(
      "Book cover lookup failed:",
      error
    );

    return null;
  }
}

export async function POST(
  req: Request
) {
  try {
    if (
      !process.env.OPENAI_API_KEY
    ) {
      return Response.json(
        {
          error:
            "OPENAI_API_KEY is missing.",
        },
        {
          status: 500,
        }
      );
    }

    const body =
      await req.json();

    const {
      likedBooks,
      dislikedBooks,
      mood,
      matters,
      readingStyle,
      avoid,
      extraNotes,
      previousRecommendations,
    } = body;

    const previous =
      Array.isArray(
        previousRecommendations
      )
        ? previousRecommendations
        : [];

    const prompt = `
You are the recommendation engine for NextChapter, a personalized book discovery app.

Your job is to recommend books that fit THIS specific reader, not simply popular books from their favorite genre.

READER PROFILE

Books they loved:
${likedBooks || "Not provided"}

Books they disliked:
${dislikedBooks || "Not provided"}

Current mood:
${mood || "No preference"}

What matters most:
${
  matters?.length
    ? matters.join(", ")
    : "No preference"
}

Preferred reading style:
${
  readingStyle?.length
    ? readingStyle.join(", ")
    : "No preference"
}

Things to avoid:
${
  avoid?.length
    ? avoid.join(", ")
    : "Nothing specified"
}

Extra notes:
${extraNotes || "Nothing specified"}

Already recommended during this session:
${
  previous.length
    ? previous.join(", ")
    : "None"
}

HOW TO RECOMMEND

Think carefully about WHY the reader liked and disliked their books.

A liked book does not mean they want five books from the exact same genre.
Infer likely preferences such as:
- pacing
- tension
- plot structure
- twists
- character focus
- atmosphere
- emotional intensity
- writing complexity
- romance level
- mystery style

Disliked books are extremely important negative signals.
Avoid recommending books that share the likely qualities the reader disliked.

Follow explicit mood, reading-style, priority, avoid, and extra-note instructions.

Accuracy is more important than novelty.

Do NOT recommend a book just because:
- it is famous
- it is trending
- it has the same genre label
- readers who liked one book also commonly buy it

Every recommendation should have a specific reason tied to this reader's actual inputs.

IMPORTANT RULES

- Recommend only real, published books.
- Never invent a title or author.
- Never recommend a book listed as liked.
- Never recommend a book listed as disliked.
- Never recommend a book listed under already recommended.
- Do not repeat the same title twice.
- Return exactly 10 candidate books.
- Keep each explanation concise, ideally 20–40 words.
- The candidates should all be strong matches, but they do not need to be identical to one another.
`;

    const response =
      await openai.responses.create({
        model: "gpt-5-mini",

        reasoning: {
          effort: "low",
        },

        input: prompt,

        text: {
          format: {
            type: "json_schema",
            name: "book_recommendations",
            strict: true,

            schema: {
              type: "object",

              properties: {
                recommendations: {
                  type: "array",
                  minItems: 10,
                  maxItems: 10,

                  items: {
                    type: "object",

                    properties: {
                      title: {
                        type: "string",
                      },

                      author: {
                        type: "string",
                      },

                      reason: {
                        type: "string",
                      },
                    },

                    required: [
                      "title",
                      "author",
                      "reason",
                    ],

                    additionalProperties:
                      false,
                  },
                },
              },

              required: [
                "recommendations",
              ],

              additionalProperties:
                false,
            },
          },
        },
      });

    if (!response.output_text) {
      throw new Error(
        "AI returned no response."
      );
    }

    const parsed =
      JSON.parse(
        response.output_text
      );

    if (
      !Array.isArray(
        parsed.recommendations
      )
    ) {
      throw new Error(
        "AI returned recommendations in the wrong format."
      );
    }

    const candidates: Recommendation[] =
      parsed.recommendations;

    // ----------------------------------
    // HARD FILTERS
    // ----------------------------------

    const forbiddenNames =
      new Set<string>();

    const addForbiddenBooks = (
      value: unknown
    ) => {
      if (
        typeof value === "string"
      ) {
        value
          .split(",")
          .map((item) =>
            item.trim()
          )
          .filter(Boolean)
          .forEach((item) =>
            forbiddenNames.add(
              normalizeBookName(
                item
              )
            )
          );
      }
    };

    addForbiddenBooks(
      likedBooks
    );

    addForbiddenBooks(
      dislikedBooks
    );

    previous.forEach(
      (item: string) => {
        forbiddenNames.add(
          normalizeBookName(
            item
          )
        );
      }
    );

    const seenTitles =
      new Set<string>();

    const filtered =
      candidates.filter(
        (book) => {
          if (
            !book?.title ||
            !book?.author ||
            !book?.reason
          ) {
            return false;
          }

          const normalizedTitle =
            normalizeBookName(
              book.title
            );

          const normalizedFull =
            normalizeBookName(
              `${book.title} by ${book.author}`
            );

          if (
            seenTitles.has(
              normalizedTitle
            )
          ) {
            return false;
          }

          const forbidden =
            [...forbiddenNames].some(
              (item) =>
                item.includes(
                  normalizedTitle
                ) ||
                normalizedTitle.includes(
                  item
                ) ||
                item ===
                  normalizedFull
            );

          if (forbidden) {
            return false;
          }

          seenTitles.add(
            normalizedTitle
          );

          return true;
        }
      );

    if (
      filtered.length < 5
    ) {
      throw new Error(
        "Could not find 5 new matching books. Please try again."
      );
    }

    const finalFive =
      filtered.slice(0, 5);

    const recommendationsWithCovers =
      await Promise.all(
        finalFive.map(
          async (book) => {
            const cover =
              await getBookCover(
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
      recommendations:
        recommendationsWithCovers,
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
          "Something went wrong.",
      },
      {
        status: 500,
      }
    );
  }
}