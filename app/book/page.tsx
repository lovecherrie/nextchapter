"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Review = {
  id: string;
  username: string;

  overall_rating: number;
  calculated_overall_rating: number | null;

  plot_rating: number | null;
  characters_rating: number | null;
  pacing_rating: number | null;
  writing_rating: number | null;
  atmosphere_rating: number | null;
  ending_rating: number | null;

  content: string;
  contains_spoilers: boolean;
  created_at: string;
};

type DiscussionPost = {
  id: string;
  username: string;
  content: string;
  contains_spoilers: boolean;
  created_at: string;
  likes: number;
  comments: number;
  likedByMe: boolean;
};

type Comment = {
  id: string;
  username: string;
  content: string;
  contains_spoilers: boolean;
  created_at: string;
  parent_comment_id: string | null;
};

type RatingValue =
  | number
  | null;

export default function BookPage() {
  const searchParams =
    useSearchParams();

  const bookExternalId =
    searchParams.get("book") ||
    "test-book";

  const bookTitle =
    searchParams.get("title") ||
    "Test Book";

  const bookAuthor =
    searchParams.get("author") ||
    "";

  const bookCover =
    searchParams.get("cover") ||
    "";

  const [
    databaseBookId,
    setDatabaseBookId,
  ] = useState<string | null>(
    null
  );

  const [
    guestUserId,
    setGuestUserId,
  ] = useState("");

  const [
    guestUsername,
    setGuestUsername,
  ] = useState("");

  const [
    activeTab,
    setActiveTab,
  ] = useState<
    "reviews" | "discussion"
  >("reviews");

  const [
    reviews,
    setReviews,
  ] = useState<Review[]>([]);

  const [posts, setPosts] =
    useState<
      DiscussionPost[]
    >([]);

  const [
    commentsByPost,
    setCommentsByPost,
  ] = useState<
    Record<string, Comment[]>
  >({});

  // -------------------------
  // REVIEW RATINGS
  // -------------------------

  const [
    plotRating,
    setPlotRating,
  ] =
    useState<RatingValue>(
      null
    );

  const [
    charactersRating,
    setCharactersRating,
  ] =
    useState<RatingValue>(
      null
    );

  const [
    pacingRating,
    setPacingRating,
  ] =
    useState<RatingValue>(
      null
    );

  const [
    writingRating,
    setWritingRating,
  ] =
    useState<RatingValue>(
      null
    );

  const [
    atmosphereRating,
    setAtmosphereRating,
  ] =
    useState<RatingValue>(
      null
    );

  const [
    endingRating,
    setEndingRating,
  ] =
    useState<RatingValue>(
      null
    );

  const [
    overallRating,
    setOverallRating,
  ] =
    useState<RatingValue>(
      null
    );

  const [
    overallWasEdited,
    setOverallWasEdited,
  ] = useState(false);

  const [
    reviewText,
    setReviewText,
  ] = useState("");

  const [
    reviewSpoiler,
    setReviewSpoiler,
  ] = useState(false);

  // -------------------------
  // DISCUSSION
  // -------------------------

  const [
    postText,
    setPostText,
  ] = useState("");

  const [
    postSpoiler,
    setPostSpoiler,
  ] = useState(false);

  const [
    discussionFilter,
    setDiscussionFilter,
  ] = useState<
    | "top"
    | "newest"
    | "spoiler-free"
  >("top");

  const [
    revealedSpoilers,
    setRevealedSpoilers,
  ] = useState<string[]>(
    []
  );

  const [
    openComments,
    setOpenComments,
  ] = useState<string[]>(
    []
  );

  const [
    commentDrafts,
    setCommentDrafts,
  ] = useState<
    Record<string, string>
  >({});

  const [
    commentSpoilers,
    setCommentSpoilers,
  ] = useState<
    Record<string, boolean>
  >({});

  const [
    replyingTo,
    setReplyingTo,
  ] = useState<
    Record<
      string,
      string | null
    >
  >({});

  const [
    loading,
    setLoading,
  ] = useState(true);

  // -------------------------
  // CALCULATED RATING
  // -------------------------

  const calculatedOverall =
    useMemo(() => {
      const ratings = [
        plotRating,
        charactersRating,
        pacingRating,
        writingRating,
        atmosphereRating,
        endingRating,
      ].filter(
        (
          rating
        ): rating is number =>
          rating !== null
      );

      if (
        ratings.length === 0
      ) {
        return null;
      }

      const average =
        ratings.reduce(
          (
            total,
            rating
          ) =>
            total + rating,
          0
        ) / ratings.length;

      return Number(
        average.toFixed(1)
      );
    }, [
      plotRating,
      charactersRating,
      pacingRating,
      writingRating,
      atmosphereRating,
      endingRating,
    ]);

  useEffect(() => {
    if (
      calculatedOverall !==
        null &&
      !overallWasEdited
    ) {
      setOverallRating(
        calculatedOverall
      );
    }

    if (
      calculatedOverall ===
        null &&
      !overallWasEdited
    ) {
      setOverallRating(null);
    }
  }, [
    calculatedOverall,
    overallWasEdited,
  ]);

  // -------------------------
  // TEMP GUEST IDENTITY
  // -------------------------

  useEffect(() => {
    let userId =
      localStorage.getItem(
        "nextchapter_guest_id"
      );

    let username =
      localStorage.getItem(
        "nextchapter_guest_username"
      );

    if (!userId) {
      userId = `guest_${crypto.randomUUID()}`;

      localStorage.setItem(
        "nextchapter_guest_id",
        userId
      );
    }

    if (!username) {
      username = `Bookworm${Math.floor(
        1000 +
          Math.random() * 9000
      )}`;

      localStorage.setItem(
        "nextchapter_guest_username",
        username
      );
    }

    setGuestUserId(
      userId
    );

    setGuestUsername(
      username
    );
  }, []);

  // -------------------------
  // FIND / CREATE BOOK
  // -------------------------

  useEffect(() => {
    let cancelled = false;

    const setupBook =
      async () => {
        setLoading(true);

        const {
          data:
            existingBook,
          error:
            lookupError,
        } = await supabase
          .from("books")
          .select("*")
          .eq(
            "external_id",
            bookExternalId
          )
          .maybeSingle();

        if (cancelled) {
          return;
        }

        if (lookupError) {
          console.error(
            "Book lookup error:",
            lookupError
          );

          setLoading(
            false
          );

          return;
        }

        if (
          existingBook?.id
        ) {
          setDatabaseBookId(
            existingBook.id
          );

          setLoading(
            false
          );

          return;
        }

        const {
          data:
            createdBook,
          error:
            createError,
        } = await supabase
          .from("books")
          .insert({
            external_id:
              bookExternalId,
            title:
              bookTitle,
            author:
              bookAuthor ||
              null,
            cover_url:
              bookCover ||
              null,
          })
          .select()
          .single();

        if (cancelled) {
          return;
        }

        if (
          !createError &&
          createdBook?.id
        ) {
          setDatabaseBookId(
            createdBook.id
          );

          setLoading(
            false
          );

          return;
        }

        // React dev mode can
        // occasionally create
        // the same book twice.
        if (
          createError?.code ===
          "23505"
        ) {
          const {
            data:
              duplicateBook,
            error:
              duplicateError,
          } =
            await supabase
              .from(
                "books"
              )
              .select("*")
              .eq(
                "external_id",
                bookExternalId
              )
              .single();

          if (cancelled) {
            return;
          }

          if (
            duplicateError ||
            !duplicateBook?.id
          ) {
            console.error(
              "Could not load existing book:",
              duplicateError
            );

            setLoading(
              false
            );

            return;
          }

          setDatabaseBookId(
            duplicateBook.id
          );

          setLoading(
            false
          );

          return;
        }

        console.error(
          "Create book error:",
          createError
        );

        setLoading(false);
      };

    setupBook();

    return () => {
      cancelled = true;
    };
  }, [
    bookExternalId,
    bookTitle,
    bookAuthor,
    bookCover,
  ]);

  // -------------------------
  // LOAD REVIEWS
  // -------------------------

  const loadReviews =
    async () => {
      if (
        !databaseBookId
      ) {
        return;
      }

      const {
        data,
        error,
      } = await supabase
        .from("reviews")
        .select("*")
        .eq(
          "book_id",
          databaseBookId
        )
        .order(
          "created_at",
          {
            ascending: false,
          }
        );

      if (error) {
        console.error(
          "Load reviews error:",
          error
        );

        return;
      }

      setReviews(
        (data || []) as Review[]
      );
    };

  // -------------------------
  // LOAD POSTS
  // -------------------------

  const loadPosts =
    async () => {
      if (
        !databaseBookId
      ) {
        return;
      }

      const {
        data: postRows,
        error,
      } = await supabase
        .from(
          "discussion_posts"
        )
        .select("*")
        .eq(
          "book_id",
          databaseBookId
        );

      if (error) {
        console.error(
          "Load discussion error:",
          error
        );

        return;
      }

      const enriched =
        await Promise.all(
          (
            postRows || []
          ).map(
            async (
              post
            ) => {
              const {
                count:
                  likeCount,
              } =
                await supabase
                  .from(
                    "discussion_likes"
                  )
                  .select(
                    "*",
                    {
                      count:
                        "exact",
                      head: true,
                    }
                  )
                  .eq(
                    "post_id",
                    post.id
                  );

              const {
                count:
                  commentCount,
              } =
                await supabase
                  .from(
                    "comments"
                  )
                  .select(
                    "*",
                    {
                      count:
                        "exact",
                      head: true,
                    }
                  )
                  .eq(
                    "post_id",
                    post.id
                  );

              let likedByMe =
                false;

              if (
                guestUserId
              ) {
                const {
                  data:
                    myLike,
                } =
                  await supabase
                    .from(
                      "discussion_likes"
                    )
                    .select(
                      "id"
                    )
                    .eq(
                      "post_id",
                      post.id
                    )
                    .eq(
                      "user_id",
                      guestUserId
                    )
                    .maybeSingle();

                likedByMe =
                  Boolean(
                    myLike
                  );
              }

              return {
                ...post,
                likes:
                  likeCount ||
                  0,
                comments:
                  commentCount ||
                  0,
                likedByMe,
              };
            }
          )
        );

      setPosts(
        enriched as DiscussionPost[]
      );
    };

  useEffect(() => {
    if (
      !databaseBookId
    ) {
      return;
    }

    loadReviews();
    loadPosts();
  }, [
    databaseBookId,
    guestUserId,
  ]);

  // -------------------------
  // SUBMIT REVIEW
  // -------------------------

  const submitReview =
    async () => {
      if (
        !databaseBookId ||
        !guestUserId
      ) {
        return;
      }

      if (
        overallRating ===
        null
      ) {
        alert(
          "Rate at least one category first."
        );

        return;
      }

      if (
        !reviewText.trim()
      ) {
        alert(
          "Write something about the book first."
        );

        return;
      }

      const {
        error,
      } = await supabase
        .from("reviews")
        .insert({
          book_id:
            databaseBookId,

          user_id:
            guestUserId,

          username:
            guestUsername,

          overall_rating:
            overallRating,

          calculated_overall_rating:
            calculatedOverall,

          plot_rating:
            plotRating,

          characters_rating:
            charactersRating,

          pacing_rating:
            pacingRating,

          writing_rating:
            writingRating,

          atmosphere_rating:
            atmosphereRating,

          ending_rating:
            endingRating,

          content:
            reviewText.trim(),

          contains_spoilers:
            reviewSpoiler,
        });

      if (error) {
        console.error(
          "Post review error:",
          error
        );

        alert(
          "Could not post review."
        );

        return;
      }

      setReviewText("");
      setReviewSpoiler(
        false
      );

      setPlotRating(null);
      setCharactersRating(
        null
      );
      setPacingRating(
        null
      );
      setWritingRating(
        null
      );
      setAtmosphereRating(
        null
      );
      setEndingRating(
        null
      );

      setOverallRating(
        null
      );

      setOverallWasEdited(
        false
      );

      await loadReviews();
    };

  // -------------------------
  // DISCUSSION POSTS
  // -------------------------

  const submitDiscussion =
    async () => {
      if (
        !databaseBookId ||
        !guestUserId ||
        !postText.trim()
      ) {
        return;
      }

      const {
        error,
      } = await supabase
        .from(
          "discussion_posts"
        )
        .insert({
          book_id:
            databaseBookId,

          user_id:
            guestUserId,

          username:
            guestUsername,

          content:
            postText.trim(),

          contains_spoilers:
            postSpoiler,
        });

      if (error) {
        console.error(
          error
        );

        alert(
          "Could not post discussion."
        );

        return;
      }

      setPostText("");
      setPostSpoiler(
        false
      );

      await loadPosts();
    };

  // -------------------------
  // LIKES
  // -------------------------

  const toggleLike =
    async (
      postId: string
    ) => {
      if (
        !guestUserId
      ) {
        return;
      }

      const {
        data:
          existingLike,
      } = await supabase
        .from(
          "discussion_likes"
        )
        .select("id")
        .eq(
          "post_id",
          postId
        )
        .eq(
          "user_id",
          guestUserId
        )
        .maybeSingle();

      if (
        existingLike?.id
      ) {
        const {
          error,
        } = await supabase
          .from(
            "discussion_likes"
          )
          .delete()
          .eq(
            "id",
            existingLike.id
          );

        if (error) {
          console.error(
            error
          );

          return;
        }
      } else {
        const {
          error,
        } = await supabase
          .from(
            "discussion_likes"
          )
          .insert({
            post_id:
              postId,

            user_id:
              guestUserId,
          });

        if (error) {
          console.error(
            error
          );

          return;
        }
      }

      await loadPosts();
    };

  // -------------------------
  // COMMENTS
  // -------------------------

  const loadComments =
    async (
      postId: string
    ) => {
      const {
        data,
        error,
      } = await supabase
        .from("comments")
        .select("*")
        .eq(
          "post_id",
          postId
        )
        .order(
          "created_at",
          {
            ascending: true,
          }
        );

      if (error) {
        console.error(
          error
        );

        return;
      }

      setCommentsByPost(
        (
          previous
        ) => ({
          ...previous,
          [postId]:
            (data ||
              []) as Comment[],
        })
      );
    };

  const toggleComments =
    async (
      postId: string
    ) => {
      const isOpen =
        openComments.includes(
          postId
        );

      if (isOpen) {
        setOpenComments(
          (
            previous
          ) =>
            previous.filter(
              (id) =>
                id !== postId
            )
        );

        return;
      }

      setOpenComments(
        (
          previous
        ) => [
          ...previous,
          postId,
        ]
      );

      await loadComments(
        postId
      );
    };

  const submitComment =
    async (
      postId: string
    ) => {
      const content =
        commentDrafts[
          postId
        ]?.trim();

      if (
        !guestUserId ||
        !content
      ) {
        return;
      }

      const {
        error,
      } = await supabase
        .from("comments")
        .insert({
          post_id:
            postId,

          user_id:
            guestUserId,

          username:
            guestUsername,

          content,

          contains_spoilers:
            commentSpoilers[
              postId
            ] || false,

          parent_comment_id:
            replyingTo[
              postId
            ] || null,
        });

      if (error) {
        console.error(
          error
        );

        alert(
          "Could not post comment."
        );

        return;
      }

      setCommentDrafts(
        (
          previous
        ) => ({
          ...previous,
          [postId]: "",
        })
      );

      setCommentSpoilers(
        (
          previous
        ) => ({
          ...previous,
          [postId]: false,
        })
      );

      setReplyingTo(
        (
          previous
        ) => ({
          ...previous,
          [postId]: null,
        })
      );

      await loadComments(
        postId
      );

      await loadPosts();
    };

  // -------------------------
  // SPOILERS
  // -------------------------

  const revealSpoiler = (
    id: string
  ) => {
    setRevealedSpoilers(
      (
        previous
      ) => [
        ...previous,
        id,
      ]
    );
  };

  const spoilerContent = (
    id: string,
    text: string,
    hasSpoiler: boolean
  ) => {
    const revealed =
      revealedSpoilers.includes(
        id
      );

    if (
      !hasSpoiler ||
      revealed
    ) {
      return (
        <p className="whitespace-pre-wrap leading-7 text-stone-700">
          {text}
        </p>
      );
    }

    return (
      <button
        type="button"
        onClick={() =>
          revealSpoiler(
            id
          )
        }
        className="w-full rounded-2xl border border-dashed border-amber-300 bg-amber-50 px-5 py-6 text-left"
      >
        <div className="text-sm font-semibold text-amber-800">
          ⚠ Contains
          spoilers
        </div>

        <div className="mt-1 text-sm text-amber-700">
          Tap to reveal this
          content.
        </div>
      </button>
    );
  };

  // -------------------------
  // HELPERS
  // -------------------------

  const formatDate = (
    date: string
  ) => {
    return new Date(
      date
    ).toLocaleString(
      undefined,
      {
        dateStyle:
          "medium",
        timeStyle:
          "short",
      }
    );
  };

  const averageRating =
    reviews.length > 0
      ? (
          reviews.reduce(
            (
              total,
              review
            ) =>
              total +
              Number(
                review.overall_rating
              ),
            0
          ) /
          reviews.length
        ).toFixed(1)
      : null;

  const filteredPosts = [
    ...posts,
  ]
    .filter((post) => {
      if (
        discussionFilter ===
        "spoiler-free"
      ) {
        return !post.contains_spoilers;
      }

      return true;
    })
    .sort((a, b) => {
      if (
        discussionFilter ===
        "top" &&
        b.likes !==
          a.likes
      ) {
        return (
          b.likes -
          a.likes
        );
      }

      return (
        new Date(
          b.created_at
        ).getTime() -
        new Date(
          a.created_at
        ).getTime()
      );
    });

  const ratingRows = [
    {
      label: "Plot",
      description:
        "Story, structure & ideas",
      value:
        plotRating,
      onChange:
        setPlotRating,
    },
    {
      label:
        "Characters",
      description:
        "Depth, development & chemistry",
      value:
        charactersRating,
      onChange:
        setCharactersRating,
    },
    {
      label: "Pacing",
      description:
        "How well the story moves",
      value:
        pacingRating,
      onChange:
        setPacingRating,
    },
    {
      label: "Writing",
      description:
        "Prose, dialogue & style",
      value:
        writingRating,
      onChange:
        setWritingRating,
    },
    {
      label:
        "Atmosphere",
      description:
        "Mood, setting & immersion",
      value:
        atmosphereRating,
      onChange:
        setAtmosphereRating,
    },
    {
      label: "Ending",
      description:
        "Payoff & satisfaction",
      value:
        endingRating,
      onChange:
        setEndingRating,
    },
  ];

  return (
    <main className="min-h-screen bg-[#f7f2e8] text-stone-900">
      <div className="mx-auto max-w-5xl px-5 py-8 md:py-12">

        {/* BOOK HEADER */}

        <a
          href="/"
          className="text-sm font-medium text-stone-500 hover:text-stone-900"
        >
          ← Back to
          NextChapter
        </a>

        <section className="mt-6 rounded-[32px] border border-stone-200 bg-[#fffdf8] p-6 shadow-sm md:p-8">
          <div className="flex gap-5">

            {bookCover ? (
              <img
                src={
                  bookCover
                }
                alt={
                  bookTitle
                }
                className="h-40 w-28 rounded-xl object-cover shadow-md"
              />
            ) : (
              <div className="flex h-40 w-28 shrink-0 items-center justify-center rounded-xl bg-[#e9dfcf] text-4xl">
                📖
              </div>
            )}

            <div className="flex flex-col justify-center">

              <div className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#8a6f47]">
                NextChapter
              </div>

              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                {bookTitle}
              </h1>

              {bookAuthor && (
                <p className="mt-2 text-stone-500">
                  by{" "}
                  {bookAuthor}
                </p>
              )}

              <p className="mt-4 max-w-xl text-sm leading-6 text-stone-600">
                See what readers
                think, rate the
                book in detail,
                or join the
                discussion.
              </p>

            </div>
          </div>
        </section>

        {/* TABS */}

        <div className="mt-7 grid grid-cols-2 rounded-2xl border border-stone-200 bg-[#fffdf8] p-1.5 shadow-sm">

          <button
            type="button"
            onClick={() =>
              setActiveTab(
                "reviews"
              )
            }
            className={`rounded-xl px-5 py-3 font-medium transition ${
              activeTab ===
              "reviews"
                ? "bg-[#4f5f45] text-white shadow-sm"
                : "text-stone-600 hover:bg-stone-100"
            }`}
          >
            Reviews
          </button>

          <button
            type="button"
            onClick={() =>
              setActiveTab(
                "discussion"
              )
            }
            className={`rounded-xl px-5 py-3 font-medium transition ${
              activeTab ===
              "discussion"
                ? "bg-[#4f5f45] text-white shadow-sm"
                : "text-stone-600 hover:bg-stone-100"
            }`}
          >
            💬 Discussion
          </button>

        </div>

        {loading && (
          <div className="py-20 text-center text-stone-500">
            Opening the
            book...
          </div>
        )}

        {/* REVIEWS */}

        {!loading &&
          activeTab ===
            "reviews" && (
            <section className="mt-7">

              <div className="grid gap-6 md:grid-cols-[260px_1fr]">

                {/* READER SCORE */}

                <div className="h-fit rounded-[28px] border border-stone-200 bg-[#fffdf8] p-6 shadow-sm">

                  <div className="text-sm font-semibold text-stone-500">
                    Reader score
                  </div>

                  <div className="mt-3 flex items-end gap-2">

                    <div className="text-5xl font-semibold text-[#4f5f45]">
                      {averageRating ||
                        "—"}
                    </div>

                    {averageRating && (
                      <div className="pb-1 text-sm text-stone-400">
                        / 10
                      </div>
                    )}

                  </div>

                  <p className="mt-3 text-sm text-stone-500">
                    {reviews.length}{" "}
                    {reviews.length ===
                    1
                      ? "review"
                      : "reviews"}
                  </p>

                  <p className="mt-5 text-xs leading-5 text-stone-400">
                    Reader score
                    uses each
                    person's final
                    overall rating.
                  </p>

                </div>

                {/* WRITE REVIEW */}

                <div className="rounded-[28px] border border-stone-200 bg-[#fffdf8] p-6 shadow-sm md:p-7">

                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#8a6f47]">
                    Your rating
                  </div>

                  <h2 className="mt-2 text-2xl font-semibold">
                    How was this
                    book?
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-stone-500">
                    Rate as many
                    categories as
                    you want. We
                    calculate an
                    overall score,
                    then you can
                    adjust it to
                    match how you
                    actually feel.
                  </p>

                  {/* CATEGORY RATINGS */}

                  <div className="mt-7 space-y-4">

                    {ratingRows.map(
                      (
                        category
                      ) => (
                        <div
                          key={
                            category.label
                          }
                          className="rounded-2xl border border-stone-200 bg-white p-4"
                        >

                          <div className="flex items-start justify-between gap-4">

                            <div>
                              <div className="font-semibold text-stone-700">
                                {
                                  category.label
                                }
                              </div>

                              <div className="mt-0.5 text-xs text-stone-400">
                                {
                                  category.description
                                }
                              </div>
                            </div>

                            <div
                              className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${
                                category.value !==
                                null
                                  ? "bg-[#e5ecdf] text-[#4f5f45]"
                                  : "bg-stone-100 text-stone-400"
                              }`}
                            >
                              {category.value !==
                              null
                                ? `${category.value.toFixed(
                                    1
                                  )}`
                                : "—"}
                            </div>

                          </div>

                          <input
                            type="range"
                            min="1"
                            max="10"
                            step="0.5"
                            value={
                              category.value ??
                              5.5
                            }
                            onChange={(
                              event
                            ) =>
                              category.onChange(
                                Number(
                                  event
                                    .target
                                    .value
                                )
                              )
                            }
                            className="mt-4 w-full cursor-pointer accent-[#4f5f45]"
                          />

                          <div className="mt-1 flex justify-between text-[10px] text-stone-400">
                            <span>
                              1
                            </span>

                            <span>
                              5
                            </span>

                            <span>
                              10
                            </span>
                          </div>

                          {category.value !==
                            null && (
                            <button
                              type="button"
                              onClick={() =>
                                category.onChange(
                                  null
                                )
                              }
                              className="mt-2 text-[11px] text-stone-400 hover:text-stone-700"
                            >
                              Clear
                              rating
                            </button>
                          )}

                        </div>
                      )
                    )}

                  </div>

                  {/* CALCULATED SCORE */}

                  <div className="mt-6 rounded-2xl bg-[#eef2ea] p-5">

                    <div className="text-sm font-semibold text-[#536149]">
                      NextChapter
                      calculated
                      score
                    </div>

                    <div className="mt-2 flex items-end gap-2">

                      <div className="text-4xl font-semibold text-[#3f4c38]">
                        {calculatedOverall !==
                        null
                          ? calculatedOverall.toFixed(
                              1
                            )
                          : "—"}
                      </div>

                      {calculatedOverall !==
                        null && (
                        <div className="pb-1 text-sm text-[#718069]">
                          / 10
                        </div>
                      )}

                    </div>

                    <p className="mt-2 text-xs leading-5 text-stone-500">
                      We average
                      only the
                      categories
                      you chose to
                      rate.
                    </p>

                  </div>

                  {/* FINAL OVERALL */}

                  <div className="mt-6 rounded-2xl border border-[#d8d0bf] bg-[#fffaf0] p-5">

                    <div className="flex items-start justify-between gap-5">

                      <div>
                        <h3 className="font-semibold">
                          Your
                          overall
                          rating
                        </h3>

                        <p className="mt-1 max-w-md text-xs leading-5 text-stone-500">
                          Does the
                          calculated
                          score feel
                          right? You
                          can change
                          it.
                        </p>
                      </div>

                      <div className="text-right">

                        <div className="text-3xl font-semibold text-[#4f5f45]">
                          {overallRating !==
                          null
                            ? overallRating.toFixed(
                                1
                              )
                            : "—"}
                        </div>

                        {overallRating !==
                          null && (
                          <div className="text-xs text-stone-400">
                            / 10
                          </div>
                        )}

                      </div>

                    </div>

                    <input
                      type="range"
                      min="1"
                      max="10"
                      step="0.5"
                      disabled={
                        calculatedOverall ===
                          null &&
                        overallRating ===
                          null
                      }
                      value={
                        overallRating ??
                        calculatedOverall ??
                        5.5
                      }
                      onChange={(
                        event
                      ) => {
                        setOverallRating(
                          Number(
                            event
                              .target
                              .value
                          )
                        );

                        setOverallWasEdited(
                          true
                        );
                      }}
                      className="mt-5 w-full cursor-pointer accent-[#4f5f45] disabled:cursor-not-allowed disabled:opacity-40"
                    />

                    <div className="mt-1 flex justify-between text-[10px] text-stone-400">
                      <span>
                        1
                      </span>
                      <span>
                        5
                      </span>
                      <span>
                        10
                      </span>
                    </div>

                    {overallWasEdited &&
                      calculatedOverall !==
                        null && (
                        <button
                          type="button"
                          onClick={() => {
                            setOverallWasEdited(
                              false
                            );

                            setOverallRating(
                              calculatedOverall
                            );
                          }}
                          className="mt-3 text-xs font-medium text-[#5e704f] hover:underline"
                        >
                          Reset to
                          calculated
                          score
                        </button>
                      )}

                  </div>

                  {/* REVIEW TEXT */}

                  <textarea
                    value={
                      reviewText
                    }
                    onChange={(
                      event
                    ) =>
                      setReviewText(
                        event
                          .target
                          .value
                      )
                    }
                    placeholder="What did you think of this book?"
                    className="mt-6 min-h-36 w-full resize-none rounded-2xl border border-stone-200 bg-white p-4 outline-none transition focus:border-[#6e7e60]"
                  />

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-4">

                    <label className="flex cursor-pointer items-center gap-2 text-sm text-stone-600">

                      <input
                        type="checkbox"
                        checked={
                          reviewSpoiler
                        }
                        onChange={(
                          event
                        ) =>
                          setReviewSpoiler(
                            event
                              .target
                              .checked
                          )
                        }
                      />

                      Contains
                      spoilers

                    </label>

                    <button
                      type="button"
                      onClick={
                        submitReview
                      }
                      className="rounded-full bg-[#4f5f45] px-6 py-3 text-sm font-semibold text-white hover:bg-[#425039]"
                    >
                      Post review
                    </button>

                  </div>

                </div>
              </div>

              {/* REVIEW FEED */}

              <div className="mt-7 space-y-4">

                {reviews.length ===
                  0 && (
                  <div className="rounded-[28px] border border-dashed border-stone-300 bg-[#fffdf8] px-6 py-12 text-center">

                    <div className="text-3xl">
                      📚
                    </div>

                    <h3 className="mt-3 font-semibold">
                      No reviews
                      yet
                    </h3>

                    <p className="mt-1 text-sm text-stone-500">
                      Be the first
                      reader to
                      review this
                      book.
                    </p>

                  </div>
                )}

                {reviews.map(
                  (
                    review
                  ) => (
                    <article
                      key={
                        review.id
                      }
                      className="rounded-[28px] border border-stone-200 bg-[#fffdf8] p-6 shadow-sm"
                    >

                      <div className="flex flex-wrap items-start justify-between gap-3">

                        <div>

                          <button
                            type="button"
                            className="font-semibold hover:underline"
                          >
                            {
                              review.username
                            }
                          </button>

                          <div className="mt-2 flex items-end gap-2">

                            <span className="text-3xl font-semibold text-[#4f5f45]">
                              {Number(
                                review.overall_rating
                              ).toFixed(
                                1
                              )}
                            </span>

                            <span className="pb-1 text-sm text-stone-400">
                              / 10
                            </span>

                          </div>

                        </div>

                        <div className="text-xs text-stone-400">
                          {formatDate(
                            review.created_at
                          )}
                        </div>

                      </div>

                      <div className="mt-5">
                        {spoilerContent(
                          `review-${review.id}`,
                          review.content,
                          review.contains_spoilers
                        )}
                      </div>

                      {/* RATING BREAKDOWN */}

                      <div className="mt-5">

                        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">
                          Rating
                          breakdown
                        </div>

                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">

                          {[
                            [
                              "Plot",
                              review.plot_rating,
                            ],
                            [
                              "Characters",
                              review.characters_rating,
                            ],
                            [
                              "Pacing",
                              review.pacing_rating,
                            ],
                            [
                              "Writing",
                              review.writing_rating,
                            ],
                            [
                              "Atmosphere",
                              review.atmosphere_rating,
                            ],
                            [
                              "Ending",
                              review.ending_rating,
                            ],
                          ].map(
                            ([
                              label,
                              value,
                            ]) => (
                              <div
                                key={String(
                                  label
                                )}
                                className="rounded-xl bg-[#f5f0e6] px-3 py-2"
                              >

                                <div className="text-[11px] text-stone-500">
                                  {
                                    label
                                  }
                                </div>

                                <div className="mt-0.5 text-sm font-semibold text-stone-700">
                                  {value !==
                                    null &&
                                  value !==
                                    undefined
                                    ? `${Number(
                                        value
                                      ).toFixed(
                                        1
                                      )}/10`
                                    : "—"}
                                </div>

                              </div>
                            )
                          )}

                        </div>

                      </div>

                      {/* CALCULATED VS FINAL */}

                      {review.calculated_overall_rating !==
                        null && (
                        <div className="mt-4 text-xs text-stone-400">
                          Calculated
                          score:{" "}
                          {Number(
                            review.calculated_overall_rating
                          ).toFixed(
                            1
                          )}
                          /10
                          {Number(
                            review.calculated_overall_rating
                          ) !==
                            Number(
                              review.overall_rating
                            ) &&
                            " · Reader adjusted their overall score"}
                        </div>
                      )}

                      <div className="mt-4">

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            review.contains_spoilers
                              ? "bg-amber-100 text-amber-800"
                              : "bg-[#e5ecdf] text-[#506246]"
                          }`}
                        >
                          {review.contains_spoilers
                            ? "⚠ Contains spoilers"
                            : "✓ Spoiler-free"}
                        </span>

                      </div>

                    </article>
                  )
                )}

              </div>

            </section>
          )}

        {/* DISCUSSION */}

        {!loading &&
          activeTab ===
            "discussion" && (
            <section className="mt-7">

              {/* CREATE POST */}

              <div className="rounded-[28px] border border-stone-200 bg-[#fffdf8] p-6 shadow-sm md:p-7">

                <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#8a6f47]">
                  Book Club
                </div>

                <h2 className="mt-2 text-2xl font-semibold">
                  Talk about
                  this book 🪱
                </h2>

                <p className="mt-2 text-sm text-stone-500">
                  Share a
                  theory,
                  question,
                  character
                  opinion,
                  ending debate
                  or unpopular
                  opinion.
                </p>

                <div className="mt-4 flex flex-wrap gap-2">

                  {[
                    "Theory",
                    "Question",
                    "Character",
                    "Ending",
                    "Unpopular opinion",
                  ].map(
                    (
                      idea
                    ) => (
                      <button
                        type="button"
                        key={
                          idea
                        }
                        onClick={() =>
                          setPostText(
                            `${idea}: `
                          )
                        }
                        className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-100"
                      >
                        {
                          idea
                        }
                      </button>
                    )
                  )}

                </div>

                <textarea
                  value={
                    postText
                  }
                  onChange={(
                    event
                  ) =>
                    setPostText(
                      event
                        .target
                        .value
                    )
                  }
                  placeholder="What do you want to talk about?"
                  className="mt-5 min-h-36 w-full resize-none rounded-2xl border border-stone-200 bg-white p-4 outline-none transition focus:border-[#6e7e60]"
                />

                <div className="mt-4 flex flex-wrap items-center justify-between gap-4">

                  <label className="flex cursor-pointer items-center gap-2 text-sm text-stone-600">

                    <input
                      type="checkbox"
                      checked={
                        postSpoiler
                      }
                      onChange={(
                        event
                      ) =>
                        setPostSpoiler(
                          event
                            .target
                            .checked
                        )
                      }
                    />

                    Contains
                    spoilers

                  </label>

                  <button
                    type="button"
                    onClick={
                      submitDiscussion
                    }
                    className="rounded-full bg-[#4f5f45] px-6 py-3 text-sm font-semibold text-white hover:bg-[#425039]"
                  >
                    Post
                    discussion
                  </button>

                </div>

              </div>

              {/* FILTERS */}

              <div className="mt-6 flex flex-wrap gap-2">

                {[
                  {
                    key: "top",
                    label: "Top",
                  },
                  {
                    key:
                      "newest",
                    label:
                      "Newest",
                  },
                  {
                    key:
                      "spoiler-free",
                    label:
                      "Spoiler-free",
                  },
                ].map(
                  (
                    item
                  ) => (
                    <button
                      type="button"
                      key={
                        item.key
                      }
                      onClick={() =>
                        setDiscussionFilter(
                          item.key as
                            | "top"
                            | "newest"
                            | "spoiler-free"
                        )
                      }
                      className={`rounded-full px-4 py-2 text-sm font-medium ${
                        discussionFilter ===
                        item.key
                          ? "bg-[#4f5f45] text-white"
                          : "border border-stone-200 bg-[#fffdf8] text-stone-600"
                      }`}
                    >
                      {
                        item.label
                      }
                    </button>
                  )
                )}

              </div>

              {/* POSTS */}

              <div className="mt-5 space-y-5">

                {filteredPosts.length ===
                  0 && (
                  <div className="rounded-[28px] border border-dashed border-stone-300 bg-[#fffdf8] px-6 py-12 text-center">

                    <div className="text-3xl">
                      🪱
                    </div>

                    <h3 className="mt-3 font-semibold">
                      Quiet in
                      here... for
                      now
                    </h3>

                    <p className="mt-1 text-sm text-stone-500">
                      Start the
                      first
                      discussion
                      about this
                      book.
                    </p>

                  </div>
                )}

                {filteredPosts.map(
                  (
                    post
                  ) => {
                    const comments =
                      commentsByPost[
                        post.id
                      ] || [];

                    const topLevelComments =
                      comments.filter(
                        (
                          comment
                        ) =>
                          !comment.parent_comment_id
                      );

                    return (
                      <article
                        key={
                          post.id
                        }
                        className="rounded-[28px] border border-stone-200 bg-[#fffdf8] p-6 shadow-sm"
                      >

                        <div className="flex flex-wrap items-start justify-between gap-3">

                          <div>

                            <button
                              type="button"
                              className="font-semibold hover:underline"
                            >
                              {
                                post.username
                              }
                            </button>

                            <div className="mt-2">

                              <span
                                className={`rounded-full px-3 py-1 text-xs font-medium ${
                                  post.contains_spoilers
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-[#e5ecdf] text-[#506246]"
                                }`}
                              >
                                {post.contains_spoilers
                                  ? "⚠ Contains spoilers"
                                  : "✓ Spoiler-free"}
                              </span>

                            </div>

                          </div>

                          <div className="text-xs text-stone-400">
                            {formatDate(
                              post.created_at
                            )}
                          </div>

                        </div>

                        <div className="mt-5">
                          {spoilerContent(
                            `post-${post.id}`,
                            post.content,
                            post.contains_spoilers
                          )}
                        </div>

                        <div className="mt-5 flex items-center gap-5 border-t border-stone-100 pt-4">

                          <button
                            type="button"
                            onClick={() =>
                              toggleLike(
                                post.id
                              )
                            }
                            className={`text-sm font-medium ${
                              post.likedByMe
                                ? "text-rose-600"
                                : "text-stone-500"
                            }`}
                          >
                            {post.likedByMe
                              ? "♥"
                              : "♡"}{" "}
                            {
                              post.likes
                            }
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              toggleComments(
                                post.id
                              )
                            }
                            className="text-sm font-medium text-stone-500"
                          >
                            💬{" "}
                            {
                              post.comments
                            }
                          </button>

                        </div>

                        {/* COMMENTS */}

                        {openComments.includes(
                          post.id
                        ) && (
                          <div className="mt-6 border-t border-stone-100 pt-5">

                            <div className="space-y-4">

                              {topLevelComments.map(
                                (
                                  comment
                                ) => {
                                  const replies =
                                    comments.filter(
                                      (
                                        item
                                      ) =>
                                        item.parent_comment_id ===
                                        comment.id
                                    );

                                  return (
                                    <div
                                      key={
                                        comment.id
                                      }
                                    >

                                      <div className="rounded-2xl bg-[#f5f0e6] p-4">

                                        <div className="flex flex-wrap items-center justify-between gap-2">

                                          <button
                                            type="button"
                                            className="text-sm font-semibold hover:underline"
                                          >
                                            {
                                              comment.username
                                            }
                                          </button>

                                          <span className="text-[11px] text-stone-400">
                                            {formatDate(
                                              comment.created_at
                                            )}
                                          </span>

                                        </div>

                                        {comment.contains_spoilers && (
                                          <div className="mt-2">
                                            <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-800">
                                              ⚠
                                              Spoiler
                                            </span>
                                          </div>
                                        )}

                                        <div className="mt-3">
                                          {spoilerContent(
                                            `comment-${comment.id}`,
                                            comment.content,
                                            comment.contains_spoilers
                                          )}
                                        </div>

                                        <button
                                          type="button"
                                          onClick={() =>
                                            setReplyingTo(
                                              (
                                                previous
                                              ) => ({
                                                ...previous,
                                                [post.id]:
                                                  comment.id,
                                              })
                                            )
                                          }
                                          className="mt-3 text-xs font-medium text-stone-500 hover:text-stone-900"
                                        >
                                          Reply
                                        </button>

                                      </div>

                                      {/* REPLIES */}

                                      {replies.map(
                                        (
                                          reply
                                        ) => (
                                          <div
                                            key={
                                              reply.id
                                            }
                                            className="ml-7 mt-2 rounded-2xl border-l-2 border-[#c9b899] bg-stone-50 p-4"
                                          >

                                            <div className="flex flex-wrap items-center justify-between gap-2">

                                              <button
                                                type="button"
                                                className="text-sm font-semibold hover:underline"
                                              >
                                                {
                                                  reply.username
                                                }
                                              </button>

                                              <span className="text-[11px] text-stone-400">
                                                {formatDate(
                                                  reply.created_at
                                                )}
                                              </span>

                                            </div>

                                            {reply.contains_spoilers && (
                                              <div className="mt-2">
                                                <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-800">
                                                  ⚠
                                                  Spoiler
                                                </span>
                                              </div>
                                            )}

                                            <div className="mt-3">
                                              {spoilerContent(
                                                `reply-${reply.id}`,
                                                reply.content,
                                                reply.contains_spoilers
                                              )}
                                            </div>

                                          </div>
                                        )
                                      )}

                                    </div>
                                  );
                                }
                              )}

                            </div>

                            {/* COMMENT FORM */}

                            {replyingTo[
                              post.id
                            ] && (
                              <div className="mt-5 flex items-center justify-between rounded-xl bg-[#eef2ea] px-3 py-2 text-xs text-[#536149]">

                                <span>
                                  Replying
                                  to a
                                  comment
                                </span>

                                <button
                                  type="button"
                                  onClick={() =>
                                    setReplyingTo(
                                      (
                                        previous
                                      ) => ({
                                        ...previous,
                                        [post.id]:
                                          null,
                                      })
                                    )
                                  }
                                  className="font-semibold"
                                >
                                  Cancel
                                </button>

                              </div>
                            )}

                            <textarea
                              value={
                                commentDrafts[
                                  post.id
                                ] || ""
                              }
                              onChange={(
                                event
                              ) =>
                                setCommentDrafts(
                                  (
                                    previous
                                  ) => ({
                                    ...previous,
                                    [post.id]:
                                      event
                                        .target
                                        .value,
                                  })
                                )
                              }
                              placeholder={
                                replyingTo[
                                  post.id
                                ]
                                  ? "Write a reply..."
                                  : "Join the discussion..."
                              }
                              className="mt-4 min-h-24 w-full resize-none rounded-2xl border border-stone-200 bg-white p-3 text-sm outline-none focus:border-[#6e7e60]"
                            />

                            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">

                              <label className="flex items-center gap-2 text-xs text-stone-500">

                                <input
                                  type="checkbox"
                                  checked={
                                    commentSpoilers[
                                      post.id
                                    ] ||
                                    false
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    setCommentSpoilers(
                                      (
                                        previous
                                      ) => ({
                                        ...previous,
                                        [post.id]:
                                          event
                                            .target
                                            .checked,
                                      })
                                    )
                                  }
                                />

                                Contains
                                spoilers

                              </label>

                              <button
                                type="button"
                                onClick={() =>
                                  submitComment(
                                    post.id
                                  )
                                }
                                className="rounded-full bg-[#4f5f45] px-5 py-2 text-sm font-semibold text-white"
                              >
                                {replyingTo[
                                  post.id
                                ]
                                  ? "Post reply"
                                  : "Post comment"}
                              </button>

                            </div>

                          </div>
                        )}

                      </article>
                    );
                  }
                )}

              </div>

            </section>
          )}

        {/* TEMP USER */}

        <div className="mt-10 text-center text-xs text-stone-400">
          Posting as{" "}
          <span className="font-medium">
            {guestUsername ||
              "Bookworm"}
          </span>
          . Profiles are
          coming later.
        </div>

      </div>
    </main>
  );
}