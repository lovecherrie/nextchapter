"use client";

import {
  useEffect,
  useState,
} from "react";
import SiteHeader from "../components/SiteHeader";
import { supabase } from "@/lib/supabase";

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

export default function AepilogFindBooks() {
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
  ] = useState<BookSearchResult[]>([]);

  const [
    dislikedResults,
    setDislikedResults,
  ] = useState<BookSearchResult[]>([]);

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
  ] = useState<Recommendation[]>([]);

  const [
    seenRecommendations,
    setSeenRecommendations,
  ] = useState<string[]>(
    []
  );

  const [
    rejectedRecommendations,
    setRejectedRecommendations,
  ] = useState<string[]>(
    []
  );

  const [
    showResults,
    setShowResults,
  ] = useState(false);

  const [
    savedBookKeys,
    setSavedBookKeys,
  ] = useState<string[]>([]);

  const [
    savingBookKey,
    setSavingBookKey,
  ] = useState<string | null>(null);

  const [
    sessionRestored,
    setSessionRestored,
  ] = useState(false);

  // ----------------------------------
  // PRESERVE FIND-BOOKS SESSION
  // ----------------------------------

  useEffect(() => {
    try {
      const saved =
        sessionStorage.getItem(
          "nextchapter_find_session"
        );

      if (saved) {
        const parsed =
          JSON.parse(saved);

        setLikedBooks(
          Array.isArray(
            parsed.likedBooks
          )
            ? parsed.likedBooks
            : []
        );

        setDislikedBooks(
          Array.isArray(
            parsed.dislikedBooks
          )
            ? parsed.dislikedBooks
            : []
        );

        setMood(
          typeof parsed.mood ===
            "string"
            ? parsed.mood
            : ""
        );

        setMatters(
          Array.isArray(
            parsed.matters
          )
            ? parsed.matters
            : []
        );

        setReadingStyle(
          Array.isArray(
            parsed.readingStyle
          )
            ? parsed.readingStyle
            : []
        );

        setAvoid(
          Array.isArray(
            parsed.avoid
          )
            ? parsed.avoid
            : []
        );

        setExtraNotes(
          typeof parsed.extraNotes ===
            "string"
            ? parsed.extraNotes
            : ""
        );

        setRecommendations(
          Array.isArray(
            parsed.recommendations
          )
            ? parsed.recommendations
            : []
        );

        setSeenRecommendations(
          Array.isArray(
            parsed.seenRecommendations
          )
            ? parsed.seenRecommendations
            : []
        );

        setRejectedRecommendations(
          Array.isArray(
            parsed.rejectedRecommendations
          )
            ? parsed.rejectedRecommendations
            : []
        );

        setShowResults(
          Boolean(
            parsed.showResults &&
              Array.isArray(
                parsed.recommendations
              ) &&
              parsed.recommendations
                .length > 0
          )
        );
      }
    } catch (error) {
      console.error(
        "Could not restore Find Books session:",
        error
      );
    } finally {
      setSessionRestored(true);
    }
  }, []);

  useEffect(() => {
    if (!sessionRestored) {
      return;
    }

    try {
      sessionStorage.setItem(
        "nextchapter_find_session",
        JSON.stringify({
          likedBooks,
          dislikedBooks,
          mood,
          matters,
          readingStyle,
          avoid,
          extraNotes,
          recommendations,
          seenRecommendations,
          rejectedRecommendations,
          showResults,
        })
      );
    } catch (error) {
      console.error(
        "Could not save Find Books session:",
        error
      );
    }
  }, [
    sessionRestored,
    likedBooks,
    dislikedBooks,
    mood,
    matters,
    readingStyle,
    avoid,
    extraNotes,
    recommendations,
    seenRecommendations,
    rejectedRecommendations,
    showResults,
  ]);

  const moods = [
    {
      n: "Dark",
    },
    {
      n: "Cozy",
    },
    {
      n: "Emotional",
    },
    {
      n: "Funny",
    },
    {
      n: "Creepy",
    },
    {
      n: "Romantic",
    },
    {
      n: "Mind-bending",
    },
    {
      n: "Comforting",
    },
    {
      n: "Surprise me",
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
  // FIXED: added AbortController + an "isCurrent" flag so an older,
  // slower request can never overwrite the results of a newer one.

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

    const controller =
      new AbortController();

    let isCurrent = true;

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
                )}`,
                {
                  signal:
                    controller.signal,
                }
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

            if (
              isCurrent
            ) {
              setLikedResults(
                data.books ||
                  []
              );
            }
          } catch (
            error: any
          ) {
            if (
              error?.name !==
                "AbortError" &&
              isCurrent
            ) {
              console.error(
                "Liked book search error:",
                error
              );

              setLikedResults(
                []
              );
            }
          } finally {
            if (
              isCurrent
            ) {
              setLikedSearching(
                false
              );
            }
          }
        },
        350
      );

    return () => {
      isCurrent = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [likedQuery]);

  // ----------------------------------
  // SEARCH DISLIKED BOOKS
  // ----------------------------------
  // FIXED: same AbortController + "isCurrent" guard as above.

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

    const controller =
      new AbortController();

    let isCurrent = true;

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
                )}`,
                {
                  signal:
                    controller.signal,
                }
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

            if (
              isCurrent
            ) {
              setDislikedResults(
                data.books ||
                  []
              );
            }
          } catch (
            error: any
          ) {
            if (
              error?.name !==
                "AbortError" &&
              isCurrent
            ) {
              console.error(
                "Disliked book search error:",
                error
              );

              setDislikedResults(
                []
              );
            }
          } finally {
            if (
              isCurrent
            ) {
              setDislikedSearching(
                false
              );
            }
          }
        },
        350
      );

    return () => {
      isCurrent = false;
      clearTimeout(timer);
      controller.abort();
    };
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

      params.set(
        "from",
        "recommendations"
      );

      return `/book?${params.toString()}`;
    };

  // ----------------------------------
  // WANT TO READ
  // ----------------------------------

  const recommendationKey = (
    book: Recommendation
  ) =>
    `${book.title}::${book.author}`
      .toLowerCase()
      .trim();

  async function ensureDatabaseBook(
    book: Recommendation
  ) {
    const externalId =
      makeBookId(book);

    const {
      data: existingByExternalId,
      error: externalLookupError,
    } = await supabase
      .from("books")
      .select(
        "id, external_id, title, author, cover_url"
      )
      .eq(
        "external_id",
        externalId
      )
      .maybeSingle();

    if (externalLookupError) {
      throw externalLookupError;
    }

    if (existingByExternalId) {
      return existingByExternalId;
    }

    const {
      data: existingByTitle,
      error: titleLookupError,
    } = await supabase
      .from("books")
      .select(
        "id, external_id, title, author, cover_url"
      )
      .ilike(
        "title",
        book.title.trim()
      )
      .limit(10);

    if (titleLookupError) {
      throw titleLookupError;
    }

    if (
      existingByTitle &&
      existingByTitle.length > 0
    ) {
      const normalizedAuthor = (book.author || "")
        .toLowerCase()
        .trim();

      const authorMatch = existingByTitle.find(
        (candidate: any) =>
          (candidate.author || "")
            .toLowerCase()
            .trim() === normalizedAuthor
      );

      return authorMatch || existingByTitle[0];
    }

    const {
      data: createdBook,
      error: createError,
    } = await supabase
      .from("books")
      .insert({
        external_id:
          externalId,
        title:
          book.title,
        author:
          book.author || null,
        cover_url:
          book.cover || null,
      })
      .select(
        "id, external_id, title, author, cover_url"
      )
      .single();

    if (createError) {
      const {
        data: retryBook,
        error: retryError,
      } = await supabase
        .from("books")
        .select(
          "id, external_id, title, author, cover_url"
        )
        .eq(
          "external_id",
          externalId
        )
        .maybeSingle();

      if (!retryError && retryBook) {
        return retryBook;
      }

      const {
        data: retryByTitle,
        error: retryByTitleError,
      } = await supabase
        .from("books")
        .select(
          "id, external_id, title, author, cover_url"
        )
        .ilike("title", book.title.trim())
        .limit(1)
        .maybeSingle();

      if (!retryByTitleError && retryByTitle) {
        return retryByTitle;
      }

      throw createError;
    }

    return createdBook;
  }

  async function loadSavedRecommendations() {
    const {
      data: authData,
      error: authError,
    } =
      await supabase.auth.getUser();

    if (
      authError ||
      !authData.user
    ) {
      return;
    }

    const {
      data,
      error,
    } = await supabase
      .from("want_to_read")
      .select(`
        book_id,
        books (
          title,
          author
        )
      `)
      .eq(
        "user_id",
        authData.user.id
      );

    if (error) {
      console.error(
        "Want to Read load error:",
        error
      );
      return;
    }

    const keys =
      (data || [])
        .map(
          (item: any) =>
            item.books
              ? `${item.books.title}::${item.books.author || ""}`
                  .toLowerCase()
                  .trim()
              : null
        )
        .filter(Boolean) as string[];

    setSavedBookKeys(keys);
  }

  async function saveWantToRead(
    book: Recommendation
  ) {
    const key =
      recommendationKey(book);

    if (
      savedBookKeys.includes(
        key
      )
    ) {
      return;
    }

    setSavingBookKey(key);

    try {
      const {
        data: authData,
        error: authError,
      } =
        await supabase.auth.getUser();

      if (authError) {
        throw authError;
      }

      if (!authData.user) {
        alert(
          "Log in or create an account to save books to Want to Read."
        );
        window.location.href =
          "/auth";
        return;
      }

      const databaseBook =
        await ensureDatabaseBook(
          book
        );

      const {
        error: saveError,
      } = await supabase
        .from("want_to_read")
        .insert({
          user_id:
            authData.user.id,
          book_id:
            databaseBook.id,
        });

      if (
        saveError &&
        saveError.code !==
          "23505"
      ) {
        throw saveError;
      }

      setSavedBookKeys(
        (current) =>
          current.includes(key)
            ? current
            : [
                ...current,
                key,
              ]
      );
    } catch (
      error
    ) {
      console.error(
        "Want to Read save error:",
        error
      );

      alert(
        "Could not save this book right now. Please try again."
      );
    } finally {
      setSavingBookKey(null);
    }
  }

  useEffect(() => {
    if (
      !showResults ||
      recommendations.length ===
        0
    ) {
      return;
    }

    loadSavedRecommendations();
  }, [
    showResults,
    recommendations,
  ]);

  // ----------------------------------
  // REJECT RECOMMENDATION
  // ----------------------------------

  const rejectRecommendation = (
    book: Recommendation
  ) => {
    const key =
      `${book.title} by ${book.author}`;

    setRejectedRecommendations(
      (current) =>
        current.includes(key)
          ? current
          : [...current, key]
    );

    setSeenRecommendations(
      (current) =>
        current.includes(key)
          ? current
          : [...current, key]
    );

    setRecommendations(
      (current) =>
        current.filter(
          (item) =>
            !(
              item.title ===
                book.title &&
              item.author ===
                book.author
            )
        )
    );
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

                    rejectedRecommendations,
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
    <main className="min-h-screen bg-[var(--aepilog-cream)] text-[var(--aepilog-ink)]">

      <SiteHeader active="find" />

      <div className="mx-auto max-w-5xl px-5 py-10 md:py-14">

        {/* HERO */}

        <section className="rounded-[32px] border border-stone-200 bg-[#fffdf9] px-6 py-10 shadow-sm md:px-10 md:py-12">

          <div className="max-w-2xl">

            <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#a34c57]">
              Personalized
              recommendations
            </div>

            <h1 className="font-aepilog-serif mt-3 text-4xl font-medium tracking-tight md:text-5xl">
              Find a book that
              actually feels{" "}
              <span className="italic text-[#8f2635]">
                like you.
              </span>
            </h1>

            <p className="mt-5 max-w-xl leading-7 text-stone-600">
              Tell aepilog
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

          <section className="rounded-[28px] border border-stone-200 bg-[#fffdf9] p-6 shadow-sm md:p-8">

            <div className="flex items-start gap-4">

              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ebcfd0] font-semibold text-[#8f2635]">
                1
              </div>

              <div>
                <h2 className="font-aepilog-serif text-2xl font-medium">
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
                    loved
                  </div>

                  <p className="mt-1 text-xs leading-5 text-stone-500">
                    Search and
                    choose the
                    exact book.
                  </p>

                </div>

                <div className="relative">

                  <input
                    className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-4 outline-none transition placeholder:text-stone-400 focus:border-[#b65a65] focus:ring-2 focus:ring-[#ebcfd0]"
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
                    <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-80 overflow-y-auto rounded-2xl border border-stone-200 bg-[#fffdf9] shadow-xl">

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
                              className="flex w-full items-center gap-3 border-b border-stone-100 p-3 text-left transition last:border-b-0 hover:bg-[#fbf1ef]"
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
                                    No cover
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
                          className="flex items-center gap-3 rounded-2xl border border-[#e2bfc1] bg-[#f6e8e6] p-3"
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
                                No cover
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
                            Close
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
                    className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-4 outline-none transition placeholder:text-stone-400 focus:border-[#b65a65] focus:ring-2 focus:ring-[#ebcfd0]"
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
                    <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-80 overflow-y-auto rounded-2xl border border-stone-200 bg-[#fffdf9] shadow-xl">

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
                              className="flex w-full items-center gap-3 border-b border-stone-100 p-3 text-left transition last:border-b-0 hover:bg-[#fbf1ef]"
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
                                    No cover
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
                                No cover
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
                            Close
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

          <section className="rounded-[28px] border border-stone-200 bg-[#fffdf9] p-6 shadow-sm md:p-8">

            <div className="flex items-start gap-4">

              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ebcfd0] font-semibold text-[#8f2635]">
                2
              </div>

              <div>
                <h2 className="font-aepilog-serif text-2xl font-medium">
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
                        ? "border-[#8f2635] bg-[#8f2635] text-white shadow-sm"
                        : "border-stone-200 bg-white text-stone-600 hover:border-[#d8aeb2] hover:bg-[#f6e8e6]"
                    }`}
                  >
                    {item.n}
                  </button>
                )
              )}

            </div>

          </section>

          {/* STEP 3 */}

          <section className="rounded-[28px] border border-stone-200 bg-[#fffdf9] p-6 shadow-sm md:p-8">

            <div className="flex items-start gap-4">

              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ebcfd0] font-semibold text-[#8f2635]">
                3
              </div>

              <div>
                <h2 className="font-aepilog-serif text-2xl font-medium">
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
                        ? "border-[#a34c57] bg-[#f6e8e6] text-[#8f2635]"
                        : "border-stone-200 bg-white text-stone-500 hover:bg-[#fbf1ef]"
                    }`}
                  >
                    {item}
                  </button>
                )
              )}

            </div>

          </section>

          {/* STEP 4 */}

          <section className="rounded-[28px] border border-stone-200 bg-[#fffdf9] p-6 shadow-sm md:p-8">

            <div className="flex items-start gap-4">

              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ebcfd0] font-semibold text-[#8f2635]">
                4
              </div>

              <div>
                <h2 className="font-aepilog-serif text-2xl font-medium">
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
                        ? "border-[#8f2635] bg-[#ebcfd0] text-[#40503a]"
                        : "border-stone-200 bg-white text-stone-500 hover:bg-[#f6e8e6]"
                    }`}
                  >
                    {item}
                  </button>
                )
              )}

            </div>

          </section>

          {/* STEP 5 */}

          <section className="rounded-[28px] border border-stone-200 bg-[#fffdf9] p-6 shadow-sm md:p-8">

            <div className="flex items-start gap-4">

              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ebcfd0] font-semibold text-[#8f2635]">
                5
              </div>

              <div>
                <h2 className="font-aepilog-serif text-2xl font-medium">
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

          <section className="rounded-[28px] border border-stone-200 bg-[#fffdf9] p-6 shadow-sm md:p-8">

            <div className="flex items-start gap-4">

              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ebcfd0] font-semibold text-[#8f2635]">
                6
              </div>

              <div>
                <h2 className="font-aepilog-serif text-2xl font-medium">
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
              className="mt-6 min-h-32 w-full resize-none rounded-2xl border border-stone-200 bg-white p-4 leading-6 outline-none transition placeholder:text-stone-400 focus:border-[#b65a65] focus:ring-2 focus:ring-[#ebcfd0]"
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
            className="group w-full rounded-[28px] bg-[#8f2635] px-6 py-5 text-lg font-semibold text-white shadow-sm transition hover:bg-[#7b1f2d] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading
              ? "Finding your next book..."
              : "Find my next book →"}
          </button>

        </div>

      </div>

      {/* RESULTS MODAL */}

      {showResults && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/45 p-4 backdrop-blur-[2px]">

          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[32px] border border-stone-200 bg-[#faf6ef] shadow-2xl">

            {/* MODAL HEADER */}

            <div className="sticky top-0 z-10 flex items-center justify-between gap-5 border-b border-stone-200 bg-[#fffdf9]/95 p-6 backdrop-blur">

              <div>

                <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#a34c57]">
                  Your matches
                </div>

                <h2 className="font-aepilog-serif mt-1 text-3xl font-medium">
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
                Close
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
                    className="rounded-[26px] border border-stone-200 bg-[#fffdf9] p-5 shadow-sm"
                  >

                    <div className="flex gap-5">

                      <div className="flex h-40 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#f0e1de] shadow-sm">

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
                              No cover
                            </div>

                            <div className="mt-1 text-[9px] uppercase tracking-wide text-stone-400">
                              No cover
                            </div>

                          </div>
                        )}

                      </div>

                      <div className="min-w-0 flex-1">

                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#a34c57]">
                          Match{" "}
                          {index +
                            1}
                        </div>

                        <h3 className="font-aepilog-serif mt-1 text-2xl font-medium leading-snug md:text-2xl">
                          {
                            book.title
                          }
                        </h3>

                        <p className="mt-1 text-sm font-medium text-[#8f2635]">
                          by{" "}
                          {
                            book.author
                          }
                        </p>

                        <div className="mt-4 rounded-2xl bg-[#fbf1ef] p-4">

                          <div className="text-xs font-semibold text-[#a34c57]">
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
                        onClick={() =>
                          rejectRecommendation(
                            book
                          )
                        }
                        className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-500 transition hover:bg-stone-100"
                      >
                        Not for me
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          saveWantToRead(
                            book
                          )
                        }
                        disabled={
                          savingBookKey ===
                            recommendationKey(
                              book
                            ) ||
                          savedBookKeys.includes(
                            recommendationKey(
                              book
                            )
                          )
                        }
                        className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                          savedBookKeys.includes(
                            recommendationKey(
                              book
                            )
                          )
                            ? "border-[#c98e94] bg-[#f6e8e6] text-[#8f2635]"
                            : "border-[#e6d8d4] bg-white text-[#8f2635] hover:bg-[#f6e8e6]"
                        } disabled:cursor-default`}
                      >
                        {savedBookKeys.includes(
                          recommendationKey(
                            book
                          )
                        )
                          ? "Saved"
                          : savingBookKey ===
                            recommendationKey(
                              book
                            )
                          ? "Saving..."
                          : "Want to Read"}
                      </button>

                      <a
                        href={getBookPageUrl(
                          book
                        )}
                        className="rounded-full bg-[#8f2635] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#7b1f2d]"
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

            <div className="sticky bottom-0 border-t border-stone-200 bg-[#fffdf9]/95 p-5 backdrop-blur">

              <button
                type="button"
                onClick={
                  getRec
                }
                disabled={
                  loading
                }
                className="w-full rounded-2xl border border-[#8f2635] bg-white py-3.5 text-sm font-semibold text-[#8f2635] transition hover:bg-[#f6e8e6] disabled:opacity-60"
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