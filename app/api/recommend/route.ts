type AIRecommendation = {
  title: string;
  author: string;
  reason: string;
};

type VerifiedBook = {
  title: string;
  author: string;
  reason: string;
  cover: string | null;
};

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

function titlesMatch(a: string, b: string) {
  const first = normalizeText(a);
  const second = normalizeText(b);

  if (!first || !second) {
    return false;
  }

  return (
    first === second ||
    first.includes(second) ||
    second.includes(first)
  );
}

function authorsMatch(a: string, b: string) {
  const first = normalizeText(a);
  const second = normalizeText(b);

  if (!first || !second) {
    return false;
  }

  const firstParts = first.split(" ");
  const secondParts = second.split(" ");

  const firstLastName =
    firstParts[firstParts.length - 1];

  const secondLastName =
    secondParts[secondParts.length - 1];

  return (
    first === second ||
    first.includes(second) ||
    second.includes(first) ||
    firstLastName === secondLastName
  );
}

function isExcluded(
  title: string,
  exclusionStrings: string[]
) {
  const normalizedTitle =
    normalizeText(title);

  if (!normalizedTitle) {
    return true;
  }

  return exclusionStrings.some((item) => {
    const normalizedItem =
      normalizeText(item);

    if (!normalizedItem) {
      return false;
    }

    return (
      normalizedItem === normalizedTitle ||
      normalizedItem.includes(
        normalizedTitle
      ) ||
      normalizedTitle.includes(
        normalizedItem
      )
    );
  });
}

/*
  IMPORTANT:

  This function verifies that a book actually exists.

  AI suggestions are NOT trusted until
  Google Books or Open Library confirms them.
*/
async function verifyBook(
  suggestedTitle: string,
  suggestedAuthor: string
) {
  /*
    1. GOOGLE BOOKS
  */
  try {
    const search = encodeURIComponent(
      `intitle:"${suggestedTitle}" inauthor:"${suggestedAuthor}"`
    );

    const response = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${search}&maxResults=10&printType=books`
    );

    if (response.ok) {
      const data = await response.json();

      if (Array.isArray(data?.items)) {
        for (const item of data.items) {
          const info =
            item?.volumeInfo || {};

          const realTitle =
            info?.title;

          const realAuthors =
            Array.isArray(info?.authors)
              ? info.authors
              : [];

          if (
            !realTitle ||
            realAuthors.length === 0
          ) {
            continue;
          }

          const titleIsCorrect =
            titlesMatch(
              suggestedTitle,
              realTitle
            );

          const authorIsCorrect =
            realAuthors.some(
              (realAuthor: string) =>
                authorsMatch(
                  suggestedAuthor,
                  realAuthor
                )
            );

          if (
            titleIsCorrect &&
            authorIsCorrect
          ) {
            const images =
              info?.imageLinks || {};

            const cover =
              images.extraLarge ||
              images.large ||
              images.medium ||
              images.small ||
              images.thumbnail ||
              images.smallThumbnail ||
              null;

            return {
              verified: true,
              title: realTitle,
              author:
                realAuthors.join(", "),
              cover: cover
                ? cover
                    .replace(
                      "http://",
                      "https://"
                    )
                    .replace(
                      "&edge=curl",
                      ""
                    )
                : null,
            };
          }
        }
      }
    }
  } catch (error) {
    console.error(
      "Google Books verification error:",
      error
    );
  }

  /*
    2. OPEN LIBRARY FALLBACK
  */
  try {
    const params =
      new URLSearchParams({
        title: suggestedTitle,
        author: suggestedAuthor,
        limit: "10",
      });

    const response = await fetch(
      `https://openlibrary.org/search.json?${params.toString()}`
    );

    if (response.ok) {
      const data = await response.json();

      if (Array.isArray(data?.docs)) {
        for (const book of data.docs) {
          const realTitle =
            book?.title;

          const realAuthors =
            Array.isArray(
              book?.author_name
            )
              ? book.author_name
              : [];

          if (
            !realTitle ||
            realAuthors.length === 0
          ) {
            continue;
          }

          const titleIsCorrect =
            titlesMatch(
              suggestedTitle,
              realTitle
            );

          const authorIsCorrect =
            realAuthors.some(
              (realAuthor: string) =>
                authorsMatch(
                  suggestedAuthor,
                  realAuthor
                )
            );

          if (
            titleIsCorrect &&
            authorIsCorrect
          ) {
            const cover =
              book?.cover_i
                ? `https://covers.openlibrary.org/b/id/${book.cover_i}-L.jpg`
                : null;

            return {
              verified: true,
              title: realTitle,
              author:
                realAuthors.join(", "),
              cover,
            };
          }
        }
      }
    }
  } catch (error) {
    console.error(
      "Open Library verification error:",
      error
    );
  }

  /*
    Neither database confirmed it.

    Therefore NextChapter treats it as
    NONEXISTENT / UNVERIFIED.
  */
  return {
    verified: false,
    title: suggestedTitle,
    author: suggestedAuthor,
    cover: null,
  };
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
        "Content-Type":
          "application/json",
        Authorization:
          `Bearer ${process.env.GROQ_API_KEY}`,
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

        max_completion_tokens: 2600,

        reasoning_effort: "low",

        include_reasoning: false,
      }),
    }
  );

  const data =
    await response.json();

  if (!response.ok) {
    console.error(
      "Groq error:",
      data
    );

    throw new Error(
      data?.error?.message ||
        "Groq request failed"
    );
  }

  const text =
    data?.choices?.[0]
      ?.message?.content;

  if (!text) {
    throw new Error(
      "AI returned no response"
    );
  }

  return text;
}

function parseRecommendations(
  text: string
): AIRecommendation[] {
  const cleaned =
    cleanAIText(text);

  const parsed =
    JSON.parse(cleaned);

  if (
    !parsed?.recommendations ||
    !Array.isArray(
      parsed.recommendations
    )
  ) {
    throw new Error(
      "AI returned recommendations in the wrong format."
    );
  }

  return parsed.recommendations.filter(
    (book: any) =>
      typeof book?.title ===
        "string" &&
      typeof book?.author ===
        "string" &&
      typeof book?.reason ===
        "string"
  );
}

export async function POST(
  req: Request
) {
  try {
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

    /*
      Anything here is NEVER allowed
      to appear in recommendations.
    */
    const exclusions: string[] = [
      likedBooks || "",
      dislikedBooks || "",
      ...previous,
    ].filter(Boolean);

    const basePrompt = `
You are the recommendation engine for a book discovery app called NextChapter.

Your job is to suggest REAL PUBLISHED BOOKS that strongly match this reader.

The application will independently verify every book against real book databases.

If you invent a title, get the author wrong, combine a real author with a fake title, or recommend an unpublished/nonexistent book, that recommendation will be rejected.

Therefore ONLY suggest books you are highly confident actually exist.

USER

Books they loved:
${likedBooks || "None supplied"}

Books they disliked:
${dislikedBooks || "None supplied"}

Mood:
${mood || "No preference"}

What matters most:
${matters?.join(", ") || "No preference"}

Reading experience:
${readingStyle?.join(", ") || "No preference"}

Avoid:
${avoid?.join(", ") || "Nothing specified"}

Extra notes:
${extraNotes || "Nothing specified"}

FORBIDDEN BOOKS

Never recommend anything here:

${
  exclusions.length
    ? exclusions.join("\n")
    : "None"
}

HOW TO RECOMMEND

Use the reader's entire profile.

Do not simply recommend books from the same genre.

Think about WHY they probably loved the books they loved.

Think about WHY they probably disliked the books they disliked.

Then match:

- story structure
- pacing
- twists
- characters
- atmosphere
- emotional tone
- complexity
- writing style
- their requested mood
- their explicit avoid list

Accuracy is more important than novelty.

Popular books are completely acceptable when they are genuinely excellent matches.

But do not automatically give the same famous recommendations to everyone.

VARIETY

Candidates should not all feel identical.

However, NEVER add an unrelated book simply for variety.

REAL BOOK REQUIREMENT

This is extremely important:

Every recommendation MUST be a real traditionally or independently published book.

The title MUST be correct.

The author MUST be correct.

Do not invent titles.

Do not guess titles.

Do not slightly change titles.

Do not combine the title of one book with the author of another book.

If you are uncertain whether a book exists, DO NOT recommend it.

REASONS

Each reason must be specific to this reader.

Explain the connection between the recommendation and their selected preferences.

Maximum 30 words each.

OUTPUT

Generate 15 candidates.

Return ONLY valid JSON.

No markdown.
No explanation outside JSON.
No code fences.

Use exactly:

{
  "recommendations": [
    {
      "title": "Exact real book title",
      "author": "Exact real author name",
      "reason": "Why this specific reader may like it"
    }
  ]
}
`;

    const verifiedBooks:
      VerifiedBook[] = [];

    let dynamicExclusions = [
      ...exclusions,
    ];

    /*
      Up to 3 AI attempts.

      The AI gives many candidates.

      We verify every single one.

      Fake books never reach the frontend.
    */
    for (
      let attempt = 0;
      attempt < 3 &&
      verifiedBooks.length < 5;
      attempt++
    ) {
      let prompt =
        basePrompt;

      if (attempt > 0) {
        prompt += `

IMPORTANT:

We still need more VERIFIED books.

Do not repeat ANY of these:

${dynamicExclusions.join("\n")}

Give different REAL published books.
`;
      }

      let candidates:
        AIRecommendation[] = [];

      try {
        const text =
          await callGroq(
            prompt,
            attempt === 0
              ? 0.65
              : 0.75
          );

        candidates =
          parseRecommendations(
            text
          );
      } catch (error) {
        console.error(
          `AI attempt ${
            attempt + 1
          } failed:`,
          error
        );

        continue;
      }

      /*
        Check candidates one-by-one.

        This intentionally happens before
        displaying anything.
      */
      for (
        const candidate of candidates
      ) {
        if (
          verifiedBooks.length >= 5
        ) {
          break;
        }

        const suggestedTitle =
          candidate.title.trim();

        const suggestedAuthor =
          candidate.author.trim();

        const reason =
          candidate.reason.trim();

        /*
          Don't even bother checking
          something already excluded.
        */
        if (
          isExcluded(
            suggestedTitle,
            dynamicExclusions
          )
        ) {
          console.log(
            "Blocked excluded book:",
            suggestedTitle
          );

          continue;
        }

        /*
          Database verification.
        */
        const verification =
          await verifyBook(
            suggestedTitle,
            suggestedAuthor
          );

        if (
          !verification.verified
        ) {
          console.log(
            "REJECTED UNVERIFIED BOOK:",
            suggestedTitle,
            "by",
            suggestedAuthor
          );

          /*
            Add fake/unverified suggestion
            to exclusions so AI doesn't
            keep trying it.
          */
          dynamicExclusions.push(
            `${suggestedTitle} by ${suggestedAuthor}`
          );

          continue;
        }

        /*
          Check canonical title again
          against exclusions.
        */
        if (
          isExcluded(
            verification.title,
            dynamicExclusions
          )
        ) {
          continue;
        }

        /*
          Stop duplicate verified books.
        */
        const duplicate =
          verifiedBooks.some(
            (book) =>
              titlesMatch(
                book.title,
                verification.title
              )
          );

        if (duplicate) {
          continue;
        }

        verifiedBooks.push({
          title:
            verification.title,

          author:
            verification.author,

          reason,

          cover:
            verification.cover,
        });

        dynamicExclusions.push(
          `${verification.title} by ${verification.author}`
        );
      }
    }

    /*
      Never fill missing spaces with
      unverified AI guesses.
    */
    if (
      verifiedBooks.length < 5
    ) {
      throw new Error(
        "I couldn't verify 5 real matching books. Please try again."
      );
    }

    return Response.json({
      recommendations:
        verifiedBooks.slice(0, 5),
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
