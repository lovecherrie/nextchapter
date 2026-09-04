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
        { error: "AI returned no response" },
        { status: 500 }
      );
    }

    return Response.json(JSON.parse(text));
  } catch (error: any) {
    console.error("Recommendation error:", error);

    return Response.json(
      {
        error:
          error?.message ||
          "Something went wrong",
      },
      { status: 500 }
    );
  }
}