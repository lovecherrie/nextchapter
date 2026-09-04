"use client";

import { useState } from "react";

type Recommendation = {
  title: string;
  author: string;
  reason: string;
  cover?: string | null;
};

export default function NextRead() {
  const [likedBooks, setLikedBooks] = useState("");
  const [dislikedBooks, setDislikedBooks] = useState("");
  const [mood, setMood] = useState("");
  const [matters, setMatters] = useState<string[]>([]);
  const [avoid, setAvoid] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [showResults, setShowResults] = useState(false);

  const moods = [
    { n: "Mind-bending", e: "🧠" },
    { n: "Emotional", e: "😢" },
    { n: "Dark", e: "😱" },
    { n: "Romantic", e: "💕" },
    { n: "Fun", e: "😂" },
    { n: "Mystery", e: "🕵️" },
    { n: "Cozy", e: "🫶" },
    { n: "Fast-paced", e: "⚡" },
  ];

  const priorities = [
    "Plot twists",
    "Characters",
    "Fast pacing",
    "Atmosphere",
    "Mystery",
    "Writing style",
    "Emotional impact",
  ];

  const avoids = [
    "Slow burn",
    "Romance",
    "Horror",
    "Gore",
    "Fantasy",
    "Sad ending",
    "Too long",
    "Nothing",
  ];

  const toggleMatter = (p: string) => {
    if (matters.includes(p)) {
      setMatters(matters.filter((i) => i !== p));
    } else if (matters.length < 2) {
      setMatters([...matters, p]);
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
      const response = await fetch("/api/recommend", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          likedBooks,
          dislikedBooks,
          mood,
          matters,
          avoid,
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
        <section className="space-y-4">
          <h3 className="font-bold text-gray-400 uppercase text-xs underline">
            Step 1: History
          </h3>

          <input
            className="w-full p-4 border-4 border-black rounded-2xl outline-none text-black"
            placeholder="Books you liked..."
            value={likedBooks}
            onChange={(e) => setLikedBooks(e.target.value)}
          />

          <input
            className="w-full p-4 border-4 border-black rounded-2xl outline-none text-black"
            placeholder="Books you hated..."
            value={dislikedBooks}
            onChange={(e) => setDislikedBooks(e.target.value)}
          />
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
            Step 3: Priorities
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
            Choose up to 2.
          </p>
        </section>

        {/* STEP 4 */}
        <section className="space-y-4">
          <h3 className="font-bold text-gray-400 uppercase text-xs underline">
            Step 4: Avoid
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

        {/* BUTTON */}
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
                    {/* BOOK COVER */}
                    <div className="w-24 min-w-24 h-36 rounded-xl overflow-hidden bg-gray-100 border-2 border-black flex items-center justify-center">
                      {book.cover ? (
                        <img
                          src={book.cover}
                          alt={`${book.title} cover`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-center px-2">
                          <span className="text-2xl">📚</span>
                          <p className="text-[10px] font-bold text-gray-400 mt-1">
                            NO COVER
                          </p>
                        </div>
                      )}
                    </div>

                    {/* BOOK INFO */}
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
                {loading ? "Finding more..." : "Give me another 5"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}