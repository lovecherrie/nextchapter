"use client";

import {
  useEffect,
  useState,
} from "react";

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

export default function NextChapter() {
  const [
    likedBooks,
    setLikedBooks,
  ] = useState<SelectedBook[]>(
    []
  );

  const [
    dislikedBooks,
    setDislikedBooks,
  ] = useState<SelectedBook[]>(
    []
  );

  const [
    likedQuery,
    setLikedQuery,
  ] = useState("");

  const [
    dislikedQuery,
    setDislikedQuery,
  ] = useState("");

  const [
    likedResults,
    setLikedResults,
  ] = useState<
    BookSearchResult[]
  >([]);

  const [
    dislikedResults,
    setDislikedResults,
  ] = useState<
    BookSearchResult[]
  >([]);

  const [
    likedSearching,
    setLikedSearching,
  ] = useState(false);

  const [
    dislikedSearching,
    setDislikedSearching,
  ] = useState(false);

  const [mood, setMood] =
    useState("");

  const [
    matters,
    setMatters,
  ] = useState<string[]>(
    []
  );

  const [
    readingStyle,
    setReadingStyle,
  ] = useState<string[]>(
    []
  );

  const [avoid, setAvoid] =
    useState<string[]>([]);

  const [
    extraNotes,
    setExtraNotes,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    recommendations,
    setRecommendations,
  ] = useState<
    Recommendation[]
  >([]);

  const [
    seenRecommendations,
    setSeenRecommendations,
  ] = useState<string[]>(
    []
  );

  const [
    showResults,
    setShowResults,
  ] = useState(false);

  const moods = [
    {
      n: "Dark",
      e: "🌑",
    },
    {
      n: "Cozy",
      e: "☕",
    },
    {
      n: "Emotional",
      e: "😭",
    },
    {
      n: "Funny",
      e: "😂",
    },
    {
      n: "Creepy",
      e: "🕯️",
    },
    {
      n: "Romantic",
      e: "💕",
    },
    {
      n: "Mind-bending",
      e: "🧠",
    },
    {
      n: "Comforting",
      e: "🫶",
    },
    {
      n: "Surprise me",
      e: "🎲",
    },
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

  // ----------------------------------
  // SEARCH LIKED BOOKS
  // ----------------------------------

  useEffect(() => {
    if (
      likedQuery.trim()
        .length < 2
    ) {
      setLikedResults(
        []
      );

      return;
    }

    const timer =
      setTimeout(
        async () => {
          try {
            setLikedSearching(
              true
            );

            const response =
              await fetch(
                `/api/books/search?q=${encodeURIComponent(
                  likedQuery
                )}`
              );

            const data =
              await response.json();

            if (
              !response.ok
            ) {
              throw new Error(
                data.error ||
                  "Book search failed"
              );
            }

            setLikedResults(
              data.books ||
                []
            );
          } catch (
            error
          ) {
            console.error(
              "Liked book search error:",
              error
            );

            setLikedResults(
              []
            );
          } finally {
            setLikedSearching(
              false
            );
          }
        },
        350
      );

    return () =>
      clearTimeout(
        timer
      );
  }, [likedQuery]);

  // ----------------------------------
  // SEARCH DISLIKED BOOKS
  // ----------------------------------

  useEffect(() => {
    if (
      dislikedQuery.trim()
        .length < 2
    ) {
      setDislikedResults(
        []
      );

      return;
    }

    const timer =
      setTimeout(
        async () => {
          try {
            setDislikedSearching(
              true
            );

            const response =
              await fetch(
                `/api/books/search?q=${encodeURIComponent(
                  dislikedQuery
                )}`
              );

            const data =
              await response.json();

            if (
              !response.ok
            ) {
              throw new Error(
                data.error ||
                  "Book search failed"
              );
            }

            setDislikedResults(
              data.books ||
                []
            );
          } catch (
            error
          ) {
            console.error(
              "Disliked book search error:",
              error
            );

            setDislikedResults(
              []
            );
          } finally {
            setDislikedSearching(
              false
            );
          }
        },
        350
      );

    return () =>
      clearTimeout(
        timer
      );
  }, [
    dislikedQuery,
  ]);

  // ----------------------------------
  // BOOK SELECTING
  // ----------------------------------

  const addLikedBook = (
    book: BookSearchResult
  ) => {
    const alreadySelected =
      likedBooks.some(
        (item) =>
          item.id ===
          book.id
      );

    if (
      !alreadySelected
    ) {
      setLikedBooks([
        ...likedBooks,
        {
          id: book.id,
          title:
            book.title,
          author:
            book.author,
          cover:
            book.cover,
        },
      ]);
    }

    setLikedQuery("");
    setLikedResults([]);
  };

  const addDislikedBook =
    (
      book: BookSearchResult
    ) => {
      const alreadySelected =
        dislikedBooks.some(
          (item) =>
            item.id ===
            book.id
        );

      if (
        !alreadySelected
      ) {
        setDislikedBooks([
          ...dislikedBooks,
          {
            id: book.id,
            title:
              book.title,
            author:
              book.author,
            cover:
              book.cover,
          },
        ]);
      }

      setDislikedQuery(
        ""
      );

      setDislikedResults(
        []
      );
    };

  const removeLikedBook =
    (id: string) => {
      setLikedBooks(
        likedBooks.filter(
          (book) =>
            book.id !== id
        )
      );
    };

  const removeDislikedBook =
    (id: string) => {
      setDislikedBooks(
        dislikedBooks.filter(
          (book) =>
            book.id !== id
        )
      );
    };

  // ----------------------------------
  // PREFERENCE BUTTONS
  // ----------------------------------

  const toggleMatter = (
    value: string
  ) => {
    if (
      matters.includes(
        value
      )
    ) {
      setMatters(
        matters.filter(
          (item) =>
            item !== value
        )
      );
    } else if (
      matters.length < 3
    ) {
      setMatters([
        ...matters,
        value,
      ]);
    }
  };

  const toggleReadingStyle =
    (
      value: string
    ) => {
      if (
        readingStyle.includes(
          value
        )
      ) {
        setReadingStyle(
          readingStyle.filter(
            (item) =>
              item !==
              value
          )
        );
      } else if (
        readingStyle.length <
        2
      ) {
        setReadingStyle([
          ...readingStyle,
          value,
        ]);
      }
    };

  const toggleAvoid = (
    value: string
  ) => {
    if (
      value ===
      "Nothing"
    ) {
      setAvoid([
        "Nothing",
      ]);

      return;
    }

    const cleaned =
      avoid.filter(
        (item) =>
          item !==
          "Nothing"
      );

    if (
      cleaned.includes(
        value
      )
    ) {
      setAvoid(
        cleaned.filter(
          (item) =>
            item !== value
        )
      );
    } else {
      setAvoid([
        ...cleaned,
        value,
      ]);
    }
  };

  // ----------------------------------
  // BOOK PAGE LINK
  // ----------------------------------

  const makeBookId = (
    book: Recommendation
  ) => {
    return `${book.title}-${book.author}`
      .toLowerCase()
      .replace(
        /[^a-z0-9]+/g,
        "-"
      )
      .replace(
        /^-+|-+$/g,
        ""
      );
  };

  const getBookPageUrl =
    (
      book: Recommendation
    ) => {
      const params =
        new URLSearchParams();

      params.set(
        "book",
        makeBookId(book)
      );

      params.set(
        "title",
        book.title
      );

      params.set(
        "author",
        book.author
      );

      if (
        book.cover
      ) {
        params.set(
          "cover",
          book.cover
        );
      }

      return `/book?${params.toString()}`;
    };

  // ----------------------------------
  // GET RECOMMENDATIONS
  // ----------------------------------

  const getRec =
    async () => {
      setLoading(true);

      try {
        const likedBooksForAI =
          likedBooks
            .map(
              (book) =>
                `${book.title} by ${book.author}`
            )
            .join(", ");

        const dislikedBooksForAI =
          dislikedBooks
            .map(
              (book) =>
                `${book.title} by ${book.author}`
            )
            .join(", ");

        const response =
          await fetch(
            "/api/recommend",
            {
              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify(
                  {
                    likedBooks:
                      likedBooksForAI,

                    dislikedBooks:
                      dislikedBooksForAI,

                    mood,

                    matters,

                    readingStyle,

                    avoid,

                    extraNotes,

                    previousRecommendations:
                      seenRecommendations,
                  }
                ),
            }
          );

        const data =
          await response.json();

        if (
          !response.ok
        ) {
          throw new Error(
            data.error ||
              "Connection Error"
          );
        }

        if (
          !data.recommendations ||
          !Array.isArray(
            data.recommendations
          )
        ) {
          throw new Error(
            "AI returned recommendations in the wrong format."
          );
        }

        const newBooks =
          data.recommendations as Recommendation[];

        setRecommendations(
          newBooks
        );

        setSeenRecommendations(
          (
            previous
          ) => [
            ...previous,
            ...newBooks.map(
              (book) =>
                `${book.title} by ${book.author}`
            ),
          ]
        );

        setShowResults(
          true
        );
      } catch (
        error: any
      ) {
        alert(
          "AI is sleepy: " +
            error.message
        );
      } finally {
        setLoading(false);
      }
    };

  // ----------------------------------
  // PAGE
  // ----------------------------------

  return (
    <main className="min-h-screen bg-[#f7f2e8] text-stone-900">

      {/* NAVIGATION */}

      <header className="border-b border-stone-200 bg-[#fffdf8]/95">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-6 px-5 py-5">

          <a
            href="/"
            className="flex items-center gap-3"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#4f5f45] text-lg text-white">
              🪱
            </div>

            <div>
              <div className="text-xl font-semibold tracking-tight">
                NextChapter
              </div>

              <div className="text-[10px] uppercase tracking-[0.18em] text-[#8a6f47]">
                Find your next
                story
              </div>
            </div>
          </a>

          <nav className="flex items-center gap-1 rounded-2xl border border-stone-200 bg-white p-1.5">

            <a
              href="/"
              className="rounded-xl bg-[#4f5f45] px-4 py-2 text-sm font-semibold text-white"
            >
              Find Books
            </a>

            <a
              href="/community"
              className="rounded-xl px-4 py-2 text-sm font-medium text-stone-600 transition hover:bg-[#eef2ea] hover:text-[#4f5f45]"
            >
              Community
            </a>

          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 py-10 md:py-14">

        {/* HERO */}

        <section className="rounded-[32px] border border-stone-200 bg-[#fffdf8] px-6 py-10 shadow-sm md:px-10 md:py-12">

          <div className="max-w-2xl">

            <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#8a6f47]">
              Personalized
              recommendations
            </div>

            <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
              Find a book that
              actually feels{" "}
              <span className="italic text-[#4f5f45]">
                like you.
              </span>
            </h1>

            <p className="mt-5 max-w-xl leading-7 text-stone-600">
              Tell NextChapter
              what you love,
              what you don't,
              and what kind of
              reading mood
              you're in. We'll
              find books that
              fit.
            </p>

          </div>

        </section>

        <div className="mt-7 grid gap-7">

          {/* STEP 1 */}

          <section className="rounded-[28px] border border-stone-200 bg-[#fffdf8] p-6 shadow-sm md:p-8">

            <div className="flex items-start gap-4">

              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e5ecdf] font-semibold text-[#4f5f45]">
                1
              </div>

              <div>
                <h2 className="text-xl font-semibold">
                  Your book
                  history
                </h2>

                <p className="mt-1 text-sm text-stone-500">
                  Give us a few
                  clues about
                  your taste.
                </p>
              </div>

            </div>

            <div className="mt-7 grid gap-6 md:grid-cols-2">

              {/* LOVED */}

              <div>

                <div className="mb-3">

                  <div className="font-semibold text-stone-800">
                    Books you
                    loved 💚
                  </div>

                  <p className="mt-1 text-xs leading-5 text-stone-500">
                    Search and
                    choose the
                    exact book.
                  </p>

                </div>

                <div className="relative">

                  <input
                    className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-4 outline-none transition placeholder:text-stone-400 focus:border-[#6e7e60] focus:ring-2 focus:ring-[#e5ecdf]"
                    placeholder="Try: The Silent Patient"
                    value={
                      likedQuery
                    }
                    onChange={(
                      event
                    ) =>
                      setLikedQuery(
                        event
                          .target
                          .value
                      )
                    }
                  />

                  {likedQuery.length >=
                    2 && (
                    <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-80 overflow-y-auto rounded-2xl border border-stone-200 bg-[#fffdf8] shadow-xl">

                      {likedSearching ? (
                        <div className="p-4 text-sm text-stone-400">
                          Searching...
                        </div>
                      ) : likedResults.length >
                        0 ? (
                        likedResults.map(
                          (
                            book
                          ) => (
                            <button
                              key={
                                book.id
                              }
                              type="button"
                              onClick={() =>
                                addLikedBook(
                                  book
                                )
                              }
                              className="flex w-full items-center gap-3 border-b border-stone-100 p-3 text-left transition last:border-b-0 hover:bg-[#f5f0e6]"
                            >

                              <div className="flex h-14 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-stone-100">

                                {book.cover ? (
                                  <img
                                    src={
                                      book.cover
                                    }
                                    alt={
                                      book.title
                                    }
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <span>
                                    📚
                                  </span>
                                )}

                              </div>

                              <div className="min-w-0">

                                <p className="truncate text-sm font-semibold">
                                  {
                                    book.title
                                  }
                                </p>

                                <p className="mt-1 truncate text-xs text-stone-500">
                                  {
                                    book.author
                                  }
                                </p>

                                {book.publishedDate && (
                                  <p className="mt-1 text-[10px] text-stone-400">
                                    {
                                      book.publishedDate
                                    }
                                  </p>
                                )}

                              </div>

                            </button>
                          )
                        )
                      ) : (
                        <div className="p-4 text-sm text-stone-400">
                          No books
                          found.
                        </div>
                      )}

                    </div>
                  )}

                </div>

                {likedBooks.length >
                  0 && (
                  <div className="mt-3 space-y-2">

                    {likedBooks.map(
                      (
                        book
                      ) => (
                        <div
                          key={
                            book.id
                          }
                          className="flex items-center gap-3 rounded-2xl border border-[#cad6c2] bg-[#eef2ea] p-3"
                        >

                          <div className="h-12 w-9 shrink-0 overflow-hidden rounded-md bg-white">

                            {book.cover ? (
                              <img
                                src={
                                  book.cover
                                }
                                alt={
                                  book.title
                                }
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center">
                                📚
                              </div>
                            )}

                          </div>

                          <div className="min-w-0 flex-1">

                            <p className="truncate text-sm font-semibold text-stone-800">
                              {
                                book.title
                              }
                            </p>

                            <p className="truncate text-xs text-stone-500">
                              {
                                book.author
                              }
                            </p>

                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              removeLikedBook(
                                book.id
                              )
                            }
                            className="flex h-8 w-8 items-center justify-center rounded-full text-stone-400 transition hover:bg-white hover:text-stone-700"
                          >
                            ✕
                          </button>

                        </div>
                      )
                    )}

                  </div>
                )}

              </div>

              {/* DISLIKED */}

              <div>

                <div className="mb-3">

                  <div className="font-semibold text-stone-800">
                    Books that
                    weren't for
                    you
                  </div>

                  <p className="mt-1 text-xs leading-5 text-stone-500">
                    This helps
                    us understand
                    what to avoid.
                  </p>

                </div>

                <div className="relative">

                  <input
                    className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-4 outline-none transition placeholder:text-stone-400 focus:border-[#6e7e60] focus:ring-2 focus:ring-[#e5ecdf]"
                    placeholder="Search for a book you disliked..."
                    value={
                      dislikedQuery
                    }
                    onChange={(
                      event
                    ) =>
                      setDislikedQuery(
                        event
                          .target
                          .value
                      )
                    }
                  />

                  {dislikedQuery.length >=
                    2 && (
                    <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-80 overflow-y-auto rounded-2xl border border-stone-200 bg-[#fffdf8] shadow-xl">

                      {dislikedSearching ? (
                        <div className="p-4 text-sm text-stone-400">
                          Searching...
                        </div>
                      ) : dislikedResults.length >
                        0 ? (
                        dislikedResults.map(
                          (
                            book
                          ) => (
                            <button
                              key={
                                book.id
                              }
                              type="button"
                              onClick={() =>
                                addDislikedBook(
                                  book
                                )
                              }
                              className="flex w-full items-center gap-3 border-b border-stone-100 p-3 text-left transition last:border-b-0 hover:bg-[#f5f0e6]"
                            >

                              <div className="flex h-14 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-stone-100">

                                {book.cover ? (
                                  <img
                                    src={
                                      book.cover
                                    }
                                    alt={
                                      book.title
                                    }
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <span>
                                    📚
                                  </span>
                                )}

                              </div>

                              <div className="min-w-0">

                                <p className="truncate text-sm font-semibold">
                                  {
                                    book.title
                                  }
                                </p>

                                <p className="mt-1 truncate text-xs text-stone-500">
                                  {
                                    book.author
                                  }
                                </p>

                                {book.publishedDate && (
                                  <p className="mt-1 text-[10px] text-stone-400">
                                    {
                                      book.publishedDate
                                    }
                                  </p>
                                )}

                              </div>

                            </button>
                          )
                        )
                      ) : (
                        <div className="p-4 text-sm text-stone-400">
                          No books
                          found.
                        </div>
                      )}

                    </div>
                  )}

                </div>

                {dislikedBooks.length >
                  0 && (
                  <div className="mt-3 space-y-2">

                    {dislikedBooks.map(
                      (
                        book
                      ) => (
                        <div
                          key={
                            book.id
                          }
                          className="flex items-center gap-3 rounded-2xl border border-[#e0cfc5] bg-[#f7eee8] p-3"
                        >

                          <div className="h-12 w-9 shrink-0 overflow-hidden rounded-md bg-white">

                            {book.cover ? (
                              <img
                                src={
                                  book.cover
                                }
                                alt={
                                  book.title
                                }
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center">
                                📚
                              </div>
                            )}

                          </div>

                          <div className="min-w-0 flex-1">

                            <p className="truncate text-sm font-semibold">
                              {
                                book.title
                              }
                            </p>

                            <p className="truncate text-xs text-stone-500">
                              {
                                book.author
                              }
                            </p>

                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              removeDislikedBook(
                                book.id
                              )
                            }
                            className="flex h-8 w-8 items-center justify-center rounded-full text-stone-400 transition hover:bg-white hover:text-stone-700"
                          >
                            ✕
                          </button>

                        </div>
                      )
                    )}

                  </div>
                )}

              </div>

            </div>

          </section>

          {/* STEP 2 */}

          <section className="rounded-[28px] border border-stone-200 bg-[#fffdf8] p-6 shadow-sm md:p-8">

            <div className="flex items-start gap-4">

              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e5ecdf] font-semibold text-[#4f5f45]">
                2
              </div>

              <div>
                <h2 className="text-xl font-semibold">
                  What's the
                  mood?
                </h2>

                <p className="mt-1 text-sm text-stone-500">
                  What kind of
                  feeling do you
                  want right now?
                </p>
              </div>

            </div>

            <div className="mt-6 flex flex-wrap gap-2">

              {moods.map(
                (
                  item
                ) => (
                  <button
                    type="button"
                    key={
                      item.n
                    }
                    onClick={() =>
                      setMood(
                        item.n
                      )
                    }
                    className={`rounded-full border px-4 py-2.5 text-sm font-medium transition ${
                      mood ===
                      item.n
                        ? "border-[#4f5f45] bg-[#4f5f45] text-white shadow-sm"
                        : "border-stone-200 bg-white text-stone-600 hover:border-[#aab5a0] hover:bg-[#eef2ea]"
                    }`}
                  >
                    {item.e}{" "}
                    {item.n}
                  </button>
                )
              )}

            </div>

          </section>

          {/* STEP 3 */}

          <section className="rounded-[28px] border border-stone-200 bg-[#fffdf8] p-6 shadow-sm md:p-8">

            <div className="flex items-start gap-4">

              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e5ecdf] font-semibold text-[#4f5f45]">
                3
              </div>

              <div>
                <h2 className="text-xl font-semibold">
                  What matters
                  most?
                </h2>

                <p className="mt-1 text-sm text-stone-500">
                  Choose up to
                  three.
                </p>
              </div>

            </div>

            <div className="mt-6 flex flex-wrap gap-2">

              {priorities.map(
                (
                  item
                ) => (
                  <button
                    type="button"
                    key={
                      item
                    }
                    onClick={() =>
                      toggleMatter(
                        item
                      )
                    }
                    className={`rounded-full border px-4 py-2.5 text-sm font-medium transition ${
                      matters.includes(
                        item
                      )
                        ? "border-[#8a6f47] bg-[#f1e7d7] text-[#715936]"
                        : "border-stone-200 bg-white text-stone-500 hover:bg-[#f5f0e6]"
                    }`}
                  >
                    {item}
                  </button>
                )
              )}

            </div>

          </section>

          {/* STEP 4 */}

          <section className="rounded-[28px] border border-stone-200 bg-[#fffdf8] p-6 shadow-sm md:p-8">

            <div className="flex items-start gap-4">

              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e5ecdf] font-semibold text-[#4f5f45]">
                4
              </div>

              <div>
                <h2 className="text-xl font-semibold">
                  Reading style
                </h2>

                <p className="mt-1 text-sm text-stone-500">
                  Choose up to
                  two.
                </p>
              </div>

            </div>

            <div className="mt-6 flex flex-wrap gap-2">

              {readingStyles.map(
                (
                  item
                ) => (
                  <button
                    type="button"
                    key={
                      item
                    }
                    onClick={() =>
                      toggleReadingStyle(
                        item
                      )
                    }
                    className={`rounded-full border px-4 py-2.5 text-sm font-medium transition ${
                      readingStyle.includes(
                        item
                      )
                        ? "border-[#4f5f45] bg-[#e5ecdf] text-[#40503a]"
                        : "border-stone-200 bg-white text-stone-500 hover:bg-[#eef2ea]"
                    }`}
                  >
                    {item}
                  </button>
                )
              )}

            </div>

          </section>

          {/* STEP 5 */}

          <section className="rounded-[28px] border border-stone-200 bg-[#fffdf8] p-6 shadow-sm md:p-8">

            <div className="flex items-start gap-4">

              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e5ecdf] font-semibold text-[#4f5f45]">
                5
              </div>

              <div>
                <h2 className="text-xl font-semibold">
                  Anything to
                  avoid?
                </h2>

                <p className="mt-1 text-sm text-stone-500">
                  Tell us what
                  would ruin the
                  read.
                </p>
              </div>

            </div>

            <div className="mt-6 flex flex-wrap gap-2">

              {avoids.map(
                (
                  item
                ) => (
                  <button
                    type="button"
                    key={
                      item
                    }
                    onClick={() =>
                      toggleAvoid(
                        item
                      )
                    }
                    className={`rounded-full border px-4 py-2.5 text-sm font-medium transition ${
                      avoid.includes(
                        item
                      )
                        ? "border-[#b78a73] bg-[#f7eee8] text-[#8a5e48]"
                        : "border-stone-200 bg-white text-stone-500 hover:bg-[#f7eee8]"
                    }`}
                  >
                    {item}
                  </button>
                )
              )}

            </div>

          </section>

          {/* STEP 6 */}

          <section className="rounded-[28px] border border-stone-200 bg-[#fffdf8] p-6 shadow-sm md:p-8">

            <div className="flex items-start gap-4">

              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e5ecdf] font-semibold text-[#4f5f45]">
                6
              </div>

              <div>
                <h2 className="text-xl font-semibold">
                  Anything
                  else?
                </h2>

                <p className="mt-1 text-sm text-stone-500">
                  Optional, but
                  the more
                  specific you
                  are, the
                  better.
                </p>
              </div>

            </div>

            <textarea
              className="mt-6 min-h-32 w-full resize-none rounded-2xl border border-stone-200 bg-white p-4 leading-6 outline-none transition placeholder:text-stone-400 focus:border-[#6e7e60] focus:ring-2 focus:ring-[#e5ecdf]"
              placeholder="e.g. Under 350 pages, nothing too depressing, something I can finish on a flight..."
              value={
                extraNotes
              }
              onChange={(
                event
              ) =>
                setExtraNotes(
                  event.target
                    .value
                )
              }
            />

          </section>

          {/* GET RECOMMENDATIONS */}

          <button
            type="button"
            onClick={
              getRec
            }
            disabled={
              loading
            }
            className="group w-full rounded-[28px] bg-[#4f5f45] px-6 py-5 text-lg font-semibold text-white shadow-sm transition hover:bg-[#425039] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading
              ? "Finding your next chapter..."
              : "Find my next book →"}
          </button>

        </div>

      </div>

      {/* RESULTS MODAL */}

      {showResults && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/45 p-4 backdrop-blur-[2px]">

          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[32px] border border-stone-200 bg-[#f7f2e8] shadow-2xl">

            {/* MODAL HEADER */}

            <div className="sticky top-0 z-10 flex items-center justify-between gap-5 border-b border-stone-200 bg-[#fffdf8]/95 p-6 backdrop-blur">

              <div>

                <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#8a6f47]">
                  Your matches
                </div>

                <h2 className="mt-1 text-2xl font-semibold">
                  Books picked
                  for you
                </h2>

                <p className="mt-1 text-sm text-stone-500">
                  Tap a book to
                  see reviews
                  and join its
                  discussion.
                </p>

              </div>

              <button
                type="button"
                onClick={() =>
                  setShowResults(
                    false
                  )
                }
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-500 transition hover:bg-stone-100"
              >
                ✕
              </button>

            </div>

            {/* RECOMMENDATIONS */}

            <div className="space-y-4 p-5 md:p-6">

              {recommendations.map(
                (
                  book,
                  index
                ) => (
                  <article
                    key={`${book.title}-${book.author}-${index}`}
                    className="rounded-[26px] border border-stone-200 bg-[#fffdf8] p-5 shadow-sm"
                  >

                    <div className="flex gap-5">

                      <div className="flex h-40 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#e9dfcf] shadow-sm">

                        {book.cover ? (
                          <img
                            src={
                              book.cover
                            }
                            alt={`${book.title} cover`}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="text-center">

                            <div className="text-3xl">
                              📚
                            </div>

                            <div className="mt-1 text-[9px] uppercase tracking-wide text-stone-400">
                              No cover
                            </div>

                          </div>
                        )}

                      </div>

                      <div className="min-w-0 flex-1">

                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8a6f47]">
                          Match{" "}
                          {index +
                            1}
                        </div>

                        <h3 className="mt-1 text-xl font-semibold leading-snug md:text-2xl">
                          {
                            book.title
                          }
                        </h3>

                        <p className="mt-1 text-sm font-medium text-[#5e704f]">
                          by{" "}
                          {
                            book.author
                          }
                        </p>

                        <div className="mt-4 rounded-2xl bg-[#f5f0e6] p-4">

                          <div className="text-xs font-semibold text-[#8a6f47]">
                            Why this
                            fits you
                          </div>

                          <p className="mt-1 text-sm leading-6 text-stone-600">
                            {
                              book.reason
                            }
                          </p>

                        </div>

                      </div>

                    </div>

                    <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-stone-100 pt-4">

                      <button
                        type="button"
                        className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-500 transition hover:bg-stone-100"
                      >
                        Not for me
                      </button>

                      <a
                        href={getBookPageUrl(
                          book
                        )}
                        className="rounded-full bg-[#4f5f45] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#425039]"
                      >
                        View book
                        →
                      </a>

                    </div>

                  </article>
                )
              )}

            </div>

            {/* ANOTHER 5 */}

            <div className="sticky bottom-0 border-t border-stone-200 bg-[#fffdf8]/95 p-5 backdrop-blur">

              <button
                type="button"
                onClick={
                  getRec
                }
                disabled={
                  loading
                }
                className="w-full rounded-2xl border border-[#4f5f45] bg-white py-3.5 text-sm font-semibold text-[#4f5f45] transition hover:bg-[#eef2ea] disabled:opacity-60"
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