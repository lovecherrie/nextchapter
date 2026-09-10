type Recommendation = {
  title: string;
  author: string;
  reason: string;
};

type BookEvidence = {
  verified: boolean;
  cover: string | null;
  popularityScore: number;
};

function normalizeBookName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function tokenOverlap(a: string, b: string) {
  const aTokens = new Set(normalizeBookName(a).split(" ").filter(Boolean));
  const bTokens = new Set(normalizeBookName(b).split(" ").filter(Boolean));

  if (!aTokens.size || !bTokens.size) return 0;

  let shared = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) shared += 1;
  }

  return shared / Math.max(aTokens.size, bTokens.size);
}

function titlesLookLikeSameBook(a: string, b: string) {
  const left = normalizeBookName(a);
  const right = normalizeBookName(b);

  if (!left || !right) return false;
  if (left === right) return true;
  if (left.includes(right) || right.includes(left)) return true;

  return tokenOverlap(left, right) >= 0.7;
}

function authorsLookCompatible(a: string, b: string) {
  const left = normalizeBookName(a);
  const right = normalizeBookName(b);

  if (!left || !right) return true;
  if (left === right) return true;
  if (left.includes(right) || right.includes(left)) return true;

  const leftParts = left.split(" ");
  const rightParts = right.split(" ");

  return leftParts.some((part) => part.length > 2 && rightParts.includes(part));
}

function cleanJsonText(value: string) {
  let text = value.trim();

  if (text.startsWith("```")) {
    text = text
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/i, "")
      .trim();
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    text = text.slice(firstBrace, lastBrace + 1);
  }

  return text;
}

function parseRecommendations(rawText: string): Recommendation[] {
  const parsed = JSON.parse(cleanJsonText(rawText));

  if (!Array.isArray(parsed?.recommendations)) {
    throw new Error("AI returned recommendations in the wrong format.");
  }

  return parsed.recommendations
    .filter(
      (book: any) =>
        typeof book?.title === "string" &&
        typeof book?.author === "string" &&
        typeof book?.reason === "string"
    )
    .map((book: any) => ({
      title: book.title.trim(),
      author: book.author.trim(),
      reason: book.reason.trim(),
    }));
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 5000
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function askGemini(prompt: string): Promise<Recommendation[]> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is missing.");
  }

  const response = await fetchWithTimeout(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.35,
          responseMimeType: "application/json",
        },
      }),
    },
    18000
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Gemini failed (${response.status}): ${errorText.slice(0, 500)}`
    );
  }

  const data = await response.json();
  const text =
    data?.candidates?.[0]?.content?.parts
      ?.map((part: any) => part?.text || "")
      .join("") || "";

  if (!text) {
    throw new Error("Gemini returned no response.");
  }

  return parseRecommendations(text);
}

async function askOpenRouter(prompt: string): Promise<Recommendation[]> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is missing.");
  }

  const response = await fetchWithTimeout(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer":
          process.env.NEXT_PUBLIC_SITE_URL || "https://nextchapter.app",
        "X-Title": "NextChapter",
      },
      body: JSON.stringify({
        model: "openrouter/free",
        messages: [
          {
            role: "system",
            content:
              "You are an expert book recommendation engine. Return valid JSON only.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.35,
      }),
    },
    18000
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `OpenRouter failed (${response.status}): ${errorText.slice(0, 500)}`
    );
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;

  const text =
    typeof content === "string"
      ? content
      : Array.isArray(content)
      ? content
          .map((part: any) =>
            typeof part === "string" ? part : part?.text || ""
          )
          .join("")
      : "";

  if (!text) {
    throw new Error("OpenRouter returned no response.");
  }

  return parseRecommendations(text);
}

async function generateCandidates(prompt: string) {
  let geminiError: unknown = null;

  if (process.env.GEMINI_API_KEY) {
    try {
      const recommendations = await askGemini(prompt);

      if (recommendations.length >= 5) {
        console.log("Recommendation provider: Gemini");
        return recommendations;
      }

      throw new Error(
        `Gemini returned only ${recommendations.length} usable recommendations.`
      );
    } catch (error) {
      geminiError = error;
      console.error("Gemini recommendation attempt failed:", error);
    }
  }

  if (process.env.OPENROUTER_API_KEY) {
    try {
      const recommendations = await askOpenRouter(prompt);

      if (recommendations.length >= 5) {
        console.log("Recommendation provider: OpenRouter");
        return recommendations;
      }

      throw new Error(
        `OpenRouter returned only ${recommendations.length} usable recommendations.`
      );
    } catch (error) {
      console.error("OpenRouter recommendation attempt failed:", error);
      throw error;
    }
  }

  if (geminiError) {
    throw geminiError;
  }

  throw new Error(
    "No recommendation AI is configured. Add GEMINI_API_KEY or OPENROUTER_API_KEY."
  );
}

function logPopularity(value: unknown, multiplier: number) {
  const number = typeof value === "number" ? value : Number(value || 0);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return Math.log10(number + 1) * multiplier;
}

async function getBookEvidence(
  title: string,
  author: string
): Promise<BookEvidence> {
  let verified = false;
  let cover: string | null = null;
  let popularityScore = 0;

  const googleQuery = encodeURIComponent(`${title} ${author}`);
  const openLibraryQuery = new URLSearchParams({
    title,
    author,
    limit: "5",
    fields:
      "key,title,author_name,cover_i,isbn,editions,edition_count,ratings_count,want_to_read_count,currently_reading_count,already_read_count",
  });

  const [googleResult, openLibraryResult] = await Promise.allSettled([
    fetchWithTimeout(
      `https://www.googleapis.com/books/v1/volumes?q=${googleQuery}&maxResults=5`,
      { next: { revalidate: 86400 } as any },
      3500
    ),
    fetchWithTimeout(
      `https://openlibrary.org/search.json?${openLibraryQuery.toString()}`,
      { next: { revalidate: 86400 } as any },
      3500
    ),
  ]);

  if (googleResult.status === "fulfilled" && googleResult.value.ok) {
    try {
      const googleData = await googleResult.value.json();

      for (const item of googleData?.items || []) {
        const info = item?.volumeInfo || {};
        const googleTitle = info?.title || "";
        const googleAuthors = Array.isArray(info?.authors)
          ? info.authors.join(" ")
          : "";

        if (
          titlesLookLikeSameBook(title, googleTitle) &&
          authorsLookCompatible(author, googleAuthors)
        ) {
          verified = true;

          const imageLinks = info?.imageLinks;
          const foundCover =
            imageLinks?.extraLarge ||
            imageLinks?.large ||
            imageLinks?.medium ||
            imageLinks?.small ||
            imageLinks?.thumbnail ||
            imageLinks?.smallThumbnail;

          if (foundCover && !cover) {
            cover = foundCover
              .replace("http://", "https://")
              .replace("&edge=curl", "");
          }

          popularityScore += logPopularity(info?.ratingsCount, 2.5);
          popularityScore += logPopularity(info?.averageRating, 0.4);
          break;
        }
      }
    } catch (error) {
      console.error("Google Books evidence parse failed:", error);
    }
  }

  if (
    openLibraryResult.status === "fulfilled" &&
    openLibraryResult.value.ok
  ) {
    try {
      const openLibraryData = await openLibraryResult.value.json();

      const match = (openLibraryData?.docs || []).find((book: any) => {
        const openTitle = book?.title || "";
        const openAuthors = Array.isArray(book?.author_name)
          ? book.author_name.join(" ")
          : "";

        return (
          titlesLookLikeSameBook(title, openTitle) &&
          authorsLookCompatible(author, openAuthors)
        );
      });

      if (match) {
        verified = true;

        if (!cover && match?.cover_i) {
          cover = `https://covers.openlibrary.org/b/id/${match.cover_i}-L.jpg?default=false`;
        }

        popularityScore += logPopularity(match?.edition_count, 2.2);
        popularityScore += logPopularity(match?.ratings_count, 3.0);
        popularityScore += logPopularity(match?.want_to_read_count, 2.4);
        popularityScore += logPopularity(match?.currently_reading_count, 1.4);
        popularityScore += logPopularity(match?.already_read_count, 1.8);
      }
    } catch (error) {
      console.error("Open Library evidence parse failed:", error);
    }
  }

  return {
    verified,
    cover,
    popularityScore,
  };
}

export async function POST(req: Request) {
  try {
    if (!process.env.GEMINI_API_KEY && !process.env.OPENROUTER_API_KEY) {
      return Response.json(
        {
          error:
            "No AI API key is configured. Add GEMINI_API_KEY or OPENROUTER_API_KEY.",
        },
        { status: 500 }
      );
    }

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

    const prompt = `
You are the recommendation engine for aepilog, a personalized book discovery app.

Your goal is to recommend books the reader is genuinely likely to enjoy.

This is NOT a "find obscure books" task.
This is NOT a generic bestseller list either.

The ideal recommendation feels like the kind of book that experienced readers of the reader's favorite genre or subgenre would repeatedly recommend in book clubs, genre communities, reading groups, BookTok/BookTube circles, Goodreads-style discussions, or "what should I read next?" conversations.

READER PROFILE

Books they loved:
${likedBooks || "Not provided"}

Books they disliked:
${dislikedBooks || "Not provided"}

Current mood:
${mood || "No preference"}

What matters most:
${matters?.length ? matters.join(", ") : "No preference"}

Preferred reading style:
${readingStyle?.length ? readingStyle.join(", ") : "No preference"}

Things to avoid:
${avoid?.length ? avoid.join(", ") : "Nothing specified"}

Extra notes:
${extraNotes || "Nothing specified"}

Already recommended during this session:
${previous.length ? previous.join(", ") : "None"}

HOW TO THINK ABOUT THE READER

First infer WHY they probably loved the books they loved and WHY they disliked the books they disliked.

Consider:
- pacing
- tension and suspense
- plot structure
- quality and frequency of twists
- psychological depth
- character focus
- atmosphere
- emotional intensity
- darkness
- writing complexity
- romance level
- mystery style
- whether the story is survival-focused, domestic, psychological, procedural, literary, etc.
- whether the ending/reveal is a major part of the appeal

Disliked books are strong negative evidence. Do not recommend books that reproduce the same qualities the reader is probably reacting against.

POPULARITY / READER-COMMUNITY RULE

Accuracy and relevance come first, but when TWO books are similarly good matches, strongly prefer the one that is:
- established and well known among readers of that genre/subgenre
- commonly recommended by actual fans of similar books
- widely read enough to have a real reader community around it
- a recognizable, credible recommendation rather than a random obscure title

Aim for roughly 80–90% established or well-known-within-the-genre recommendations.

"Popular" does NOT mean only the biggest mainstream bestseller.
A book can be niche overall but should be well known among the specific readers who like that kind of book.

Do not choose an obscure book merely to look clever or original.
Use an obscure or lesser-known book only if it is an unusually strong fit.

RECOMMENDATION QUALITY RULES

- Prioritize similarity in the qualities the reader actually enjoyed, not just matching the genre label.
- A liked book does NOT mean they want five copies of that exact premise.
- Do not recommend something solely because "people who bought X also bought Y."
- Avoid lazy obvious matches when they conflict with the reader's negative signals.
- Every explanation must say specifically why THIS reader may like the book.
- Explanations should mention meaningful similarities or differences, not vague phrases like "fans will love this."
- Order the candidates from strongest overall match to weakest.
- The first candidates should combine excellent personal fit with strong reader-community credibility.

IMPORTANT HARD RULES

- Recommend only real, published books.
- Never invent a title or author.
- Never recommend a book listed as loved.
- Never recommend a book listed as disliked.
- Never recommend a book listed under already recommended.
- Do not repeat the same title twice.
- Return exactly 12 candidate books so NextChapter can verify and rank them.
- Each explanation should be concise, ideally 20–45 words.

Return ONLY valid JSON in this exact shape:

{
  "recommendations": [
    {
      "title": "Exact published title",
      "author": "Correct author name",
      "reason": "Specific explanation for this reader"
    }
  ]
}
`;

    const candidates = await generateCandidates(prompt);

    // ----------------------------------
    // HARD FILTERS
    // ----------------------------------

    const forbiddenNames = new Set<string>();

    const addForbiddenBooks = (value: unknown) => {
      if (typeof value === "string") {
        value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
          .forEach((item) =>
            forbiddenNames.add(normalizeBookName(item))
          );
      }
    };

    addForbiddenBooks(likedBooks);
    addForbiddenBooks(dislikedBooks);

    previous.forEach((item: string) => {
      forbiddenNames.add(normalizeBookName(item));
    });

    const seenTitles = new Set<string>();

    const filtered = candidates.filter((book) => {
      if (!book?.title || !book?.author || !book?.reason) {
        return false;
      }

      const normalizedTitle = normalizeBookName(book.title);
      const normalizedFull = normalizeBookName(
        `${book.title} by ${book.author}`
      );

      if (seenTitles.has(normalizedTitle)) {
        return false;
      }

      const forbidden = [...forbiddenNames].some(
        (item) =>
          item.includes(normalizedTitle) ||
          normalizedTitle.includes(item) ||
          item === normalizedFull
      );

      if (forbidden) {
        return false;
      }

      seenTitles.add(normalizedTitle);
      return true;
    });

    if (filtered.length < 5) {
      throw new Error(
        "Could not find 5 new matching books. Please try again."
      );
    }

    // ----------------------------------
    // VERIFY REAL BOOKS + LIGHT POPULARITY RANKING
    // ----------------------------------
    //
    // The AI still decides taste/relevance.
    // Google Books + Open Library are used as a sanity check and as
    // a light signal that a book is established among readers.
    // Popularity does NOT override a much better taste match.
    // ----------------------------------

    const shortlist = filtered.slice(0, 12);

    const enriched = await Promise.all(
      shortlist.map(async (book, index) => {
        const evidence = await getBookEvidence(book.title, book.author);

        // AI rank is deliberately the biggest part of the score.
        // Earlier candidates are supposed to be better taste matches.
        const relevanceScore = Math.max(0, 45 - index * 3.2);

        // Verification receives a useful boost, while popularity is only
        // a tie-breaker / supporting signal.
        const verificationBoost = evidence.verified ? 10 : 0;

        return {
          ...book,
          cover: evidence.cover,
          verified: evidence.verified,
          score:
            relevanceScore +
            verificationBoost +
            Math.min(evidence.popularityScore, 18),
        };
      })
    );

    const ranked = enriched.sort((a, b) => {
      // Prefer verified real books when the scores are otherwise close.
      if (a.verified !== b.verified) {
        const scoreDifference = Math.abs(a.score - b.score);

        if (scoreDifference < 8) {
          return a.verified ? -1 : 1;
        }
      }

      return b.score - a.score;
    });

    const finalFive = ranked.slice(0, 5).map((book) => ({
      title: book.title,
      author: book.author,
      reason: book.reason,
      cover: book.cover,
    }));

    if (finalFive.length < 5) {
      throw new Error(
        "Could not find 5 strong book recommendations. Please try again."
      );
    }

    return Response.json({
      recommendations: finalFive,
    });
  } catch (error: any) {
    console.error("Recommendation error:", error);

    return Response.json(
      {
        error:
          error?.message ||
          "Something went wrong while generating recommendations.",
      },
      { status: 500 }
    );
  }
}
