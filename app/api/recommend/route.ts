async function getBookCover(title: string, author: string) {
  try {
    // GOOGLE BOOKS
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

    // OPEN LIBRARY FALLBACK
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

function cleanAIText(value: string) {
  let cleaned = value.trim();

  cleaned = cleaned
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (
    firstBrace !== -1 &&
    lastBrace !== -1 &&
    lastBrace > firstBrace
  ) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  return cleaned;
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isBookExcluded(
  title: string,
  exclusionStrings: string[]
) {
  const normalizedTitle = normalizeText(title);

  if (!normalizedTitle) {
    return true;
  }

  return exclusionStrings.some((item) => {
    const normalizedItem = normalizeText(item);

    if (!normalizedItem) {
      return false;
    }

    return (
      normalizedItem === normalizedTitle ||
      normalizedItem.includes(normalizedTitle) ||
      normalizedTitle.includes(normalizedItem)
    );
  });
}

async function callGroq(
  prompt: string,
  temperature = 0.7
) {
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
        temperature,
        max_completion_tokens: 2200,
        reasoning_effort: "low",
        include_reasoning: false,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    console.error("Groq error:", data);

    throw new Error(
      data?.error?.message || "Groq request failed"
    );
  }

  const text = data?.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error("AI returned no response");
  }

  return text;
}

function parseRecommendations(text: string) {
  const cleaned = cleanAIText(text);

  const parsed = JSON.parse(cleaned);

  if (
    !parsed?.recommendations ||
    !Array.isArray(parsed.recommendations)
  ) {
    throw new Error(
      "AI returned recommendations in the wrong format."
    );
  }

  return parsed.recommendations.filter(
    (book: any) =>
      typeof book?.title === "string" &&
      typeof book?.author === "string" &&
      typeof book?.reason === "string"
  );
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
      previousRecommendations,
    } = body;

    const previous = Array.isArray(previousRecommendations)
      ? previousRecommendations
      : [];

    /*
      These are HARD exclusions.

      Even if the AI ignores our instructions,
      the backend removes these books before
      returning anything to the website.
    */
    const hardExclusions: string[] = [
      likedBooks || "",
      dislikedBooks || "",
      ...previous,
    ].filter(Boolean);

    const prompt = `
You are NextChapter's personalized book recommendation engine.

Your job is to find books that genuinely fit the reader's COMPLETE taste profile.

Generate 10 candidate books so the system can choose the best 5.

USER PROFILE

Books they loved:
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

Additional request:
${extraNotes || "Nothing specified"}

BOOKS THAT ARE ABSOLUTELY FORBIDDEN

The following books have either already been read by the user,
were disliked by the user,
or have already been recommended during this session:

${hardExclusions.length > 0
  ? hardExclusions.join("\n")
  : "None"}

NEVER recommend any book from the forbidden list.

RECOMMENDATION LOGIC

Evaluate the reader's COMPLETE combination of preferences.

Prioritize:

1. Learn what qualities connect the books they loved.
2. Learn what qualities may explain the books they disliked.
3. Match their current mood.
4. Strongly match their selected priorities.
5. Match their preferred reading style.
6. Respect the avoid list.
7. Respect their additional written request.
8. Accuracy is more important than popularity.
9. Do not recommend a book merely because it belongs to the same genre.
10. Do not default to the same famous books for every reader.

VARIETY

The recommendations should all strongly fit the reader,
but they should not feel like five copies of the same book.

It is okay to include popular books when they are genuinely excellent matches.

Do NOT force random or unrelated diversity.

The goal is:
HIGH ACCURACY + USEFUL VARIETY.

REASONS

Each reason should explain specifically WHY the book fits this reader.

Reference relevant preferences such as:
- books they loved
- mood
- pacing
- plot twists
- atmosphere
- reading style
- things they want to avoid

Keep each reason under 30 words.

OUTPUT

Return ONLY valid JSON.

Do not use markdown.
Do not use code fences.
Do not write anything before or after the JSON.

Use exactly this structure:

{
  "recommendations": [
    {
      "title": "Book title",
      "author": "Author name",
      "reason": "Specific reason"
    }
  ]
}

Return 10 candidate books.
`;

    let collectedBooks: any[] = [];
    let dynamicExclusions = [...hardExclusions];

    /*
      We allow up to 3 attempts.

      This gives the backend room to remove:
      - books already read
      - books already recommended
      - duplicates
      - malformed results
    */
    for (
      let attempt = 0;
      attempt < 3 && collectedBooks.length < 5;
      attempt++
    ) {
      const attemptPrompt =
        attempt === 0
          ? prompt
          : `
${prompt}

ADDITIONAL FORBIDDEN BOOKS:

${dynamicExclusions.join("\n")}

The previous attempt contained books that had to be removed.

Generate DIFFERENT valid candidates.

Do not include anything from ANY forbidden list.
`;

      let candidates: any[] = [];

      try {
        const text = await callGroq(
          attemptPrompt,
          attempt === 0 ? 0.7 : 0.8
        );

        candidates = parseRecommendations(text);
      } catch (error) {
        console.error(
          `Recommendation attempt ${attempt + 1} failed:`,
          error
        );

        continue;
      }

      for (const book of candidates) {
        if (collectedBooks.length >= 5) {
          break;
        }

        const title = book.title.trim();
        const author = book.author.trim();
        const reason = book.reason.trim();

        // HARD FILTER
        if (
          isBookExcluded(
            title,
            dynamicExclusions
          )
        ) {
          console.log(
            "Blocked excluded recommendation:",
            title
          );

          continue;
        }

        // BLOCK DUPLICATES IN THIS RESPONSE
        const alreadyCollected =
          collectedBooks.some(
            (existingBook) =>
              normalizeText(existingBook.title) ===
              normalizeText(title)
          );

        if (alreadyCollected) {
          console.log(
            "Blocked duplicate recommendation:",
            title
          );

          continue;
        }

        collectedBooks.push({
          title,
          author,
          reason,
        });

        dynamicExclusions.push(
          `${title} by ${author}`
        );
      }
    }

    if (collectedBooks.length < 5) {
      throw new Error(
        "Could not find 5 new matching books. Please try again."
      );
    }

    const finalFive =
      collectedBooks.slice(0, 5);

    // ADD COVERS
    const recommendationsWithCovers =
      await Promise.all(
        finalFive.map(
          async (book: {
            title: string;
            author: string;
            reason: string;
          }) => {
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
          "Something went wrong",
      },
      {
        status: 500,
      }
    );
  }
}
