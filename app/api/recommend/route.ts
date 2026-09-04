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

async function callGroq(prompt: string, temperature = 0.6) {
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
  max_completion_tokens: 1800,
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

Books already recommended in this session:
${previousRecommendations?.join(", ") || "None"}

HOW TO CHOOSE THE BOOKS

Before choosing the final recommendations, consider multiple candidate books and compare them against ALL of the user's inputs.

Prioritize:

1. Strongly avoid qualities likely related to books the reader disliked.
2. Understand what the reader may have enjoyed about the books they liked.
3. Match the reader's current mood.
4. Match the qualities they say matter most.
5. Match their preferred reading experience.
6. Respect everything in the avoid list.
7. Respect any specific requests in the extra notes.
8. Do not recommend a book simply because it is popular or belongs to the same broad genre.

ACCURACY VS VARIETY

Accuracy is more important than novelty.

A popular or commonly recommended book is allowed if it is genuinely one of the strongest matches.

However:
- Do not lazily default to the same famous books for every reader.
- If the user's preferences change significantly, the recommendations should also change.
- The 5 recommendations should not all be nearly identical.
- Provide variety when possible while keeping every recommendation strongly relevant.
- Do not force diversity if it reduces recommendation accuracy.

IMPORTANT RULES

- Only recommend REAL published books.
- Return exactly 5 books.
- Do not recommend books the reader listed as liked.
- Do not recommend books the reader listed as disliked.
- Do not recommend books listed under "Books already recommended in this session."
- Consider the full combination of preferences, not just one keyword.
- If preferences conflict, choose books that best balance them.
- Each reason must be specific to this reader.
- Keep every reason under 30 words.
- Do not use markdown.
- Do not include commentary before or after the JSON.

Return ONLY valid JSON using exactly this structure:

{
  "recommendations": [
    {
      "title": "Book title",
      "author": "Author name",
      "reason": "Short specific reason"
    }
  ]
}
`;

    // FIRST ATTEMPT
    const firstText = await callGroq(prompt, 0.6);

    let parsed: any;

    try {
      parsed = JSON.parse(cleanAIText(firstText));
    } catch (firstParseError) {
      console.error(
        "First JSON parse failed:",
        firstParseError
      );

      // RETRY ONCE WITH STRICTER INSTRUCTIONS
      const retryPrompt = `
The previous response was not valid JSON.

Generate the recommendation again.

${prompt}

STRICT OUTPUT REQUIREMENTS:

Return ONLY valid JSON.

Do not use markdown.
Do not use code fences.
Do not write anything before the opening { character.
Do not write anything after the closing } character.
Every string must have properly closed quotation marks.
Every object and array must be properly closed.
Keep every reason under 25 words.

Return exactly:

{
  "recommendations": [
    {
      "title": "Book title",
      "author": "Author name",
      "reason": "Short specific reason"
    }
  ]
}
`;

      const retryText = await callGroq(
        retryPrompt,
        0.3
      );

      try {
        parsed = JSON.parse(
          cleanAIText(retryText)
        );
      } catch (retryParseError) {
        console.error(
          "Retry JSON parse failed:",
          retryParseError
        );

        throw new Error(
          "AI returned invalid recommendation data. Please try again."
        );
      }
    }

    if (
      !parsed?.recommendations ||
      !Array.isArray(parsed.recommendations)
    ) {
      throw new Error(
        "AI returned recommendations in the wrong format."
      );
    }

    const validRecommendations =
      parsed.recommendations
        .filter(
          (book: any) =>
            typeof book?.title === "string" &&
            typeof book?.author === "string" &&
            typeof book?.reason === "string"
        )
        .slice(0, 5);

    if (validRecommendations.length !== 5) {
      throw new Error(
        "AI did not return exactly 5 valid recommendations."
      );
    }

    const recommendationsWithCovers =
      await Promise.all(
        validRecommendations.map(
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
