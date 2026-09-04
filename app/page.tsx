"use client";

import { useEffect, useState } from "react";

type Recommendation = {
  title: string;
  author: string;
  reason: string;
  cover?: string | null;
};

type BookSearchResult = {
  id: string;
  title: string;
  author: string;
  cover?: string | null;
  publishedDate?: string | null;
};

type SelectedBook = {
  id: string;
  title: string;
  author: string;
  cover?: string | null;
};

export default function NextRead() {
  const [likedBooks, setLikedBooks] = useState<SelectedBook[]>([]);
  const [dislikedBooks, setDislikedBooks] = useState<SelectedBook[]>([]);

  const [likedQuery, setLikedQuery] = useState("");
  const [dislikedQuery, setDislikedQuery] = useState("");

  const [likedResults, setLikedResults] = useState<BookSearchResult[]>([]);
  const [dislikedResults, setDislikedResults] = useState<BookSearchResult[]>([]);

  const [likedSearching, setLikedSearching] = useState(false);
  const [dislikedSearching, setDislikedSearching] = useState(false);

  const [mood, setMood] = useState("");
  const [matters, setMatters] = useState<string[]>([]);
  const [readingStyle, setReadingStyle] = useState<string[]>([]);
  const [avoid, setAvoid] = useState<string[]>([]);
  const [extraNotes, setExtraNotes] = useState("");

  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [showResults, setShowResults] = useState(false);

  const moods = [
    { n: "Dark", e: "🌑" },
    { n: "Cozy", e: "☕" },
    { n: "Emotional", e: "😭" },
    { n: "Funny", e: "😂" },
    { n: "Creepy", e: "🕯️" },
    { n: "Romantic", e: "💕" },
    { n: "Mind-bending", e: "🧠" },
    { n: "Comforting", e: "🫶" },
    { n: "Surprise me", e: "🎲" },
  ];

  const priorities = [
    "Plot twists",
    "Strong characters",
    "Fast pacing",
    "Beautiful writing",
    "Atmosphere",
    "Romance",
    "Suspense",
    "Emotional impact",
  ];

  const readingStyles = [
    "Easy read",
    "Page-turner",
    "Short chapters",
    "Immersive",
    "Complex",
    "Literary",
  ];

  const avoids = [
    "Slow burn",
    "Romance",
    "Horror",
    "Graphic violence",
    "Fantasy",
    "Sad ending",
    "Long books",
    "Complex writing",
    "Nothing",
  ];

  useEffect(() => {
    if (likedQuery.trim().length < 2) {
      setLikedResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setLikedSearching(true);

        const response = await fetch(
          `/api/books/search?q=${encodeURIComponent(likedQuery)}`
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Book search failed");
        }

        setLikedResults(data.books || []);
      } catch (error) {
        console.error("Liked book search error:", error);
        setLikedResults([]);
      } finally {
        setLikedSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [likedQuery]);

  useEffect(() => {
    if (dislikedQuery.trim().length < 2) {
      setDislikedResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setDislikedSearching(true);

        const response = await fetch(
          `/api/books/search?q=${encodeURIComponent(dislikedQuery)}`
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Book search failed");
        }

        setDislikedResults(data.books || []);
      } catch (error) {
        console.error("Disliked book search error:", error);
        setDislikedResults([]);
      } finally {
        setDislikedSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [dislikedQuery]);

  const addLikedBook = (book: BookSearchResult) => {
    const alreadySelected = likedBooks.some((item) => item.id === book.id);

    if (!alreadySelected) {
      setLikedBooks([
        ...likedBooks,
        {
          id: book.id,
          title: book.title,
          author: book.author,
          cover: book.cover,
        },
      ]);
    }

    setLikedQuery("");
    setLikedResults([]);
  };

  const addDislikedBook = (book: BookSearchResult) => {
    const alreadySelected = dislikedBooks.some((item) => item.id === book.id);

    if (!alreadySelected) {
      setDislikedBooks([
        ...dislikedBooks,
        {
          id: book.id,
          title: book.title,
          author: book.author,
          cover: book.cover,
        },
      ]);
    }

    setDislikedQuery("");
    setDislikedResults([]);
  };

  const removeLikedBook = (id: string) => {
    setLikedBooks(likedBooks.filter((book) => book.id !== id));
  };

  const removeDislikedBook = (id: string) => {
    setDislikedBooks(dislikedBooks.filter((book) => book.id !== id));
  };

  const toggleMatter = (p: string) => {
    if (matters.includes(p)) {
      setMatters(matters.filter((i) => i !== p));
    } else if (matters.length < 3) {
      setMatters([...matters, p]);
    }
  };

  const toggleReadingStyle = (style: string) => {
    if (readingStyle.includes(style)) {
      setReadingStyle(readingStyle.filter((i) => i !== style));
    } else if (readingStyle.length < 2) {
      setReadingStyle([...readingStyle, style]);
    }
  };

  const toggleAvoid = (a: string) => {
    if (a === "Nothing") {
      setAvoid(["Nothing"]);
    } else {
      const cleaned = avoid.filter((i) => i !== "Nothing");

      if (cleaned.includes(a)) {
        setAvoid(cleaned.filter((i) => i !== a));
      } else {
        setAvoid([...cleaned, a]);
      }
    }
  };

  const getRec = async () => {
    setLoading(true);
    setRecommendations([]);

    try {
      const likedBooksForAI = likedBooks
        .map((book) => `${book.title} by ${book.author}`)
        .join(", ");

      const dislikedBooksForAI = dislikedBooks
        .map((book) => `${book.title} by ${book.author}`)
        .join(", ");

      const response = await fetch("/api/recommend", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          likedBooks: likedBooksForAI,
          dislikedBooks: dislikedBooksForAI,
          mood,
          matters,
          readingStyle,
          avoid,
          extraNotes,
          previousRecommendations: recommendations.map(
  (book) => `${book.title} by ${book.author}`
),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Connection Error");
      }

      if (!data.recommendations || !Array.isArray(data.recommendations)) {
        throw new Error("AI returned recommendations in the wrong format.");
      }

      setRecommendations(data.recommendations);
      setShowResults(true);
    } catch (error: any) {
      alert("AI is sleepy: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-white text-black p-6 font-sans">
      <nav className="max-w-2xl mx-auto flex justify-between border-b-4 border-black pb-4 mb-10">
        <h1 className="text-2xl font-black italic uppercase">
          NextChapter
        </h1>

        <span className="text-[10px] font-bold">
          FIND BOOKS
        </span>
      </nav>

      <div className="max-w-xl mx-auto space-y-10">
        <h2 className="text-4xl font-black uppercase italic leading-none">
          Find Your Match
        </h2>

        {/* STEP 1 */}
        <section className="space-y-5">
          <h3 className="font-bold text-gray-400 uppercase text-xs underline">
            Step 1: Your Book History
          </h3>

          {/* LIKED BOOKS */}
          <div className="space-y-3">
            <div>
              <p className="font-black text-sm uppercase mb-1">
                Books you loved
              </p>

              <p className="text-xs text-gray-400 mb-3">
                Search and choose the exact book.
              </p>

              <div className="relative">
                <input
                  className="w-full p-4 border-4 border-black rounded-2xl outline-none text-black"
                  placeholder="Try: The Silent Patient"
                  value={likedQuery}
                  onChange={(e) => setLikedQuery(e.target.value)}
                />

                {likedQuery.length >= 2 && (
                  <div className="absolute left-0 right-0 top-full mt-2 bg-white border-2 border-black rounded-2xl overflow-hidden z-30 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] max-h-80 overflow-y-auto">
                    {likedSearching ? (
                      <div className="p-4 text-sm font-bold text-gray-400">
                        Searching...
                      </div>
                    ) : likedResults.length > 0 ? (
                      likedResults.map((book) => (
                        <button
                          key={book.id}
                          type="button"
                          onClick={() => addLikedBook(book)}
                          className="w-full p-3 flex items-center gap-3 text-left border-b last:border-b-0 border-gray-100 hover:bg-gray-50"
                        >
                          <div className="w-10 h-14 min-w-10 bg-gray-100 rounded overflow-hidden border border-gray-200 flex items-center justify-center">
                            {book.cover ? (
                              <img
                                src={book.cover}
                                alt={book.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span>📚</span>
                            )}
                          </div>

                          <div className="min-w-0">
                            <p className="font-black text-sm leading-tight">
                              {book.title}
                            </p>

                            <p className="text-xs text-gray-500 mt-1">
                              {book.author}
                            </p>

                            {book.publishedDate && (
                              <p className="text-[10px] text-gray-400 mt-1">
                                {book.publishedDate}
                              </p>
                            )}
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="p-4 text-sm text-gray-400">
                        No books found.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {likedBooks.length > 0 && (
              <div className="space-y-2">
                {likedBooks.map((book) => (
                  <div
                    key={book.id}
                    className="flex items-center gap-3 border-2 border-green-600 bg-green-50 rounded-xl p-2"
                  >
                    <div className="w-9 h-12 min-w-9 rounded overflow-hidden bg-white">
                      {book.cover ? (
                        <img
                          src={book.cover}
                          alt={book.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-sm">
                          📚
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-black text-sm truncate">
                        {book.title}
                      </p>

                      <p className="text-xs text-gray-500 truncate">
                        {book.author}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeLikedBook(book.id)}
                      className="font-black px-2"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* DISLIKED BOOKS */}
          <div className="space-y-3 pt-3">
            <div>
              <p className="font-black text-sm uppercase mb-1">
                Books you didn't like
              </p>

              <p className="text-xs text-gray-400 mb-3">
                This helps us avoid giving you more of the same.
              </p>

              <div className="relative">
                <input
                  className="w-full p-4 border-4 border-black rounded-2xl outline-none text-black"
                  placeholder="Search for a book you disliked..."
                  value={dislikedQuery}
                  onChange={(e) => setDislikedQuery(e.target.value)}
                />

                {dislikedQuery.length >= 2 && (
                  <div className="absolute left-0 right-0 top-full mt-2 bg-white border-2 border-black rounded-2xl overflow-hidden z-30 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] max-h-80 overflow-y-auto">
                    {dislikedSearching ? (
                      <div className="p-4 text-sm font-bold text-gray-400">
                        Searching...
                      </div>
                    ) : dislikedResults.length > 0 ? (
                      dislikedResults.map((book) => (
                        <button
                          key={book.id}
                          type="button"
                          onClick={() => addDislikedBook(book)}
                          className="w-full p-3 flex items-center gap-3 text-left border-b last:border-b-0 border-gray-100 hover:bg-gray-50"
                        >
                          <div className="w-10 h-14 min-w-10 bg-gray-100 rounded overflow-hidden border border-gray-200 flex items-center justify-center">
                            {book.cover ? (
                              <img
                                src={book.cover}
                                alt={book.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span>📚</span>
                            )}
                          </div>

                          <div className="min-w-0">
                            <p className="font-black text-sm leading-tight">
                              {book.title}
                            </p>

                            <p className="text-xs text-gray-500 mt-1">
                              {book.author}
                            </p>

                            {book.publishedDate && (
                              <p className="text-[10px] text-gray-400 mt-1">
                                {book.publishedDate}
                              </p>
                            )}
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="p-4 text-sm text-gray-400">
                        No books found.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {dislikedBooks.length > 0 && (
              <div className="space-y-2">
                {dislikedBooks.map((book) => (
                  <div
                    key={book.id}
                    className="flex items-center gap-3 border-2 border-red-500 bg-red-50 rounded-xl p-2"
                  >
                    <div className="w-9 h-12 min-w-9 rounded overflow-hidden bg-white">
                      {book.cover ? (
                        <img
                          src={book.cover}
                          alt={book.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-sm">
                          📚
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-black text-sm truncate">
                        {book.title}
                      </p>

                      <p className="text-xs text-gray-500 truncate">
                        {book.author}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeDislikedBook(book.id)}
                      className="font-black px-2"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* STEP 2 */}
        <section className="space-y-4">
          <h3 className="font-bold text-gray-400 uppercase text-xs underline">
            Step 2: Mood
          </h3>

          <div className="flex flex-wrap gap-2">
            {moods.map((m) => (
              <button
                key={m.n}
                onClick={() => setMood(m.n)}
                className={`px-4 py-3 rounded-xl border-2 font-bold text-sm ${
                  mood === m.n
                    ? "bg-black text-white border-black"
                    : "bg-white text-black border-gray-200"
                }`}
              >
                {m.e} {m.n}
              </button>
            ))}
          </div>
        </section>

        {/* STEP 3 */}
        <section className="space-y-4">
          <h3 className="font-bold text-gray-400 uppercase text-xs underline">
            Step 3: What Matters Most
          </h3>

          <div className="flex flex-wrap gap-2">
            {priorities.map((p) => (
              <button
                key={p}
                onClick={() => toggleMatter(p)}
                className={`px-4 py-2 rounded-lg border-2 font-bold text-xs ${
                  matters.includes(p)
                    ? "border-blue-600 bg-blue-50 text-blue-600 shadow-sm"
                    : "border-gray-100 text-gray-400"
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <p className="text-xs text-gray-400">
            Choose up to 3.
          </p>
        </section>

        {/* STEP 4 */}
        <section className="space-y-4">
          <h3 className="font-bold text-gray-400 uppercase text-xs underline">
            Step 4: Reading Style
          </h3>

          <div className="flex flex-wrap gap-2">
            {readingStyles.map((style) => (
              <button
                key={style}
                onClick={() => toggleReadingStyle(style)}
                className={`px-4 py-2 rounded-lg border-2 font-bold text-xs ${
                  readingStyle.includes(style)
                    ? "border-black bg-black text-white"
                    : "border-gray-100 text-gray-400"
                }`}
              >
                {style}
              </button>
            ))}
          </div>

          <p className="text-xs text-gray-400">
            Choose up to 2.
          </p>
        </section>

        {/* STEP 5 */}
        <section className="space-y-4">
          <h3 className="font-bold text-gray-400 uppercase text-xs underline">
            Step 5: Avoid
          </h3>

          <div className="flex flex-wrap gap-2">
            {avoids.map((a) => (
              <button
                key={a}
                onClick={() => toggleAvoid(a)}
                className={`px-4 py-2 rounded-lg border-2 font-bold text-xs ${
                  avoid.includes(a)
                    ? "border-red-500 bg-red-50 text-red-500 shadow-sm"
                    : "border-gray-100 text-gray-400"
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        </section>

        {/* STEP 6 */}
        <section className="space-y-4">
          <h3 className="font-bold text-gray-400 uppercase text-xs underline">
            Step 6: Anything Else?
          </h3>

          <textarea
            className="w-full p-4 border-2 border-gray-200 rounded-2xl outline-none text-black min-h-[100px] resize-none focus:border-black"
            placeholder="Optional — e.g. under 350 pages, nothing too depressing, something I can finish on a flight..."
            value={extraNotes}
            onChange={(e) => setExtraNotes(e.target.value)}
          />
        </section>

        <button
          onClick={getRec}
          disabled={loading}
          className="w-full bg-black text-white py-6 rounded-[32px] font-black text-2xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all uppercase disabled:opacity-60"
        >
          {loading ? "Analyzing..." : "Get Recommendation"}
        </button>
      </div>

      {/* RESULTS MODAL */}
      {showResults && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-[32px] border-4 border-black shadow-[10px_10px_0px_0px_rgba(0,0,0,1)]">
            <div className="sticky top-0 z-10 bg-white border-b-2 border-black p-5 flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-black uppercase italic">
                  Your Matches
                </h3>

                <p className="text-sm text-gray-500">
                  Here are 5 books picked for you.
                </p>
              </div>

              <button
                onClick={() => setShowResults(false)}
                className="text-2xl font-black px-3"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              {recommendations.map((book, index) => (
                <div
                  key={`${book.title}-${index}`}
                  className="border-2 border-black rounded-2xl p-4"
                >
                  <div className="flex gap-4">
                    <div className="w-24 min-w-24 h-36 rounded-xl overflow-hidden bg-gray-100 border-2 border-black flex items-center justify-center">
                      {book.cover ? (
                        <img
                          src={book.cover}
                          alt={`${book.title} cover`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-center px-2">
                          <span className="text-2xl">
                            📚
                          </span>

                          <p className="text-[10px] font-bold text-gray-400 mt-1">
                            NO COVER
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-gray-400 uppercase mb-1">
                        Match #{index + 1}
                      </p>

                      <h4 className="text-xl font-black uppercase italic leading-tight">
                        {book.title}
                      </h4>

                      <p className="text-blue-600 font-bold text-sm uppercase tracking-wide mt-1">
                        By {book.author}
                      </p>

                      <p className="text-gray-600 mt-3 leading-relaxed text-sm">
                        {book.reason}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <button className="border-2 border-black rounded-xl px-4 py-2 font-bold text-sm">
                      Not for me
                    </button>

                    <button className="bg-black text-white rounded-xl px-4 py-2 font-bold text-sm">
                      View book
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-5 border-t-2 border-black">
              <button
                onClick={getRec}
                disabled={loading}
                className="w-full bg-black text-white py-4 rounded-2xl font-black uppercase disabled:opacity-60"
              >
                {loading
                  ? "Finding more..."
                  : "Give me another 5"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}