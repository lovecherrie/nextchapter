"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import SiteHeader from "../components/SiteHeader";
import { supabase } from "@/lib/supabase";

type Rating = {
  user_id: string;
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

function BookPageContent() {
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

  const openedFrom =
    searchParams.get("from") ||
    "";

  const [
    bookDescription,
    setBookDescription,
  ] = useState<string | null>(
    null
  );

  const [enrichedCover, setEnrichedCover] = useState<string | null>(null);

  const [
    descriptionLoading,
    setDescriptionLoading,
  ] = useState(true);

  const [
    bookMeta,
    setBookMeta,
  ] = useState<{
    publishedDate: string | null;
    pageCount: number | null;
    categories: string[];
    publisher: string | null;
  }>({
    publishedDate: null,
    pageCount: null,
    categories: [],
    publisher: null,
  });

  const [
    isWantToRead,
    setIsWantToRead,
  ] = useState(false);

  const [
    savingWantToRead,
    setSavingWantToRead,
  ] = useState(false);

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
    "ratings" | "discussion"
  >("ratings");

  const [
    ratings,
    setRatings,
  ] = useState<Rating[]>([]);

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
  // BOOK RATING
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
    ratingThought,
    setRatingThought,
  ] = useState("");

  const [
    ratingSpoiler,
    setRatingSpoiler,
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
  // BOOK DESCRIPTION / METADATA
  // -------------------------

  useEffect(() => {
    let cancelled = false;

    const loadBookDetails =
      async () => {
        setDescriptionLoading(
          true
        );

        try {
          const response =
            await fetch(
              `/api/books/details?title=${encodeURIComponent(
                bookTitle
              )}&author=${encodeURIComponent(
                bookAuthor
              )}`,
              {
                cache:
                  "no-store",
              }
            );

          const data =
            await response.json();

          if (
            cancelled
          ) {
            return;
          }

          setBookDescription(
            typeof data.description ===
              "string" &&
              data.description.trim()
              ? data.description.trim()
              : null
          );

          setEnrichedCover(
            typeof data.cover === "string" && data.cover.trim()
              ? data.cover.trim()
              : null
          );

          setBookMeta({
            publishedDate:
              data.publishedDate ||
              null,
            pageCount:
              typeof data.pageCount ===
              "number"
                ? data.pageCount
                : null,
            categories:
              Array.isArray(
                data.categories
              )
                ? data.categories
                : [],
            publisher:
              data.publisher ||
              null,
          });
        } catch (error) {
          console.error(
            "Book details load error:",
            error
          );

          if (
            !cancelled
          ) {
            setBookDescription(
              null
            );
          }
        } finally {
          if (
            !cancelled
          ) {
            setDescriptionLoading(
              false
            );
          }
        }
      };

    loadBookDetails();

    return () => {
      cancelled = true;
    };
  }, [
    bookTitle,
    bookAuthor,
  ]);

  // -------------------------
  // ACCOUNT / GUEST IDENTITY
  // -------------------------

  useEffect(() => {
    let cancelled = false;

    const setupIdentity = async () => {
      const { data } = await supabase.auth.getUser();
      const authUser = data.user;

      if (authUser) {
        const username =
          typeof authUser.user_metadata?.username === "string" &&
          authUser.user_metadata.username.trim()
            ? authUser.user_metadata.username.trim()
            : localStorage.getItem("nextchapter_guest_username") ||
              "Bookworm";

        localStorage.setItem("nextchapter_guest_id", authUser.id);
        localStorage.setItem("nextchapter_guest_username", username);

        if (!cancelled) {
          setGuestUserId(authUser.id);
          setGuestUsername(username);
        }
        return;
      }

      let userId = localStorage.getItem("nextchapter_guest_id");
      let username = localStorage.getItem("nextchapter_guest_username");

      if (!userId) {
        userId = `guest_${crypto.randomUUID()}`;
        localStorage.setItem("nextchapter_guest_id", userId);
      }

      if (!username) {
        username = `Bookworm${Math.floor(1000 + Math.random() * 9000)}`;
        localStorage.setItem("nextchapter_guest_username", username);
      }

      if (!cancelled) {
        setGuestUserId(userId);
        setGuestUsername(username);
      }
    };

    setupIdentity();

    return () => {
      cancelled = true;
    };
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
  // WANT TO READ
  // -------------------------

  useEffect(() => {
    let cancelled = false;

    const loadWantToRead =
      async () => {
        if (
          !databaseBookId
        ) {
          return;
        }

        const {
          data: authData,
        } =
          await supabase.auth.getUser();

        if (
          !authData.user
        ) {
          if (
            !cancelled
          ) {
            setIsWantToRead(
              false
            );
          }
          return;
        }

        const {
          data,
          error,
        } = await supabase
          .from(
            "want_to_read"
          )
          .select("id")
          .eq(
            "user_id",
            authData.user.id
          )
          .eq(
            "book_id",
            databaseBookId
          )
          .maybeSingle();

        if (error) {
          console.error(
            "Want to Read load error:",
            error
          );
          return;
        }

        if (
          !cancelled
        ) {
          setIsWantToRead(
            Boolean(data)
          );
        }
      };

    loadWantToRead();

    return () => {
      cancelled = true;
    };
  }, [
    databaseBookId,
  ]);

  const toggleWantToRead =
    async () => {
      if (
        !databaseBookId ||
        savingWantToRead
      ) {
        return;
      }

      setSavingWantToRead(
        true
      );

      try {
        const {
          data: authData,
          error: authError,
        } =
          await supabase.auth.getUser();

        if (authError) {
          throw authError;
        }

        if (
          !authData.user
        ) {
          sessionStorage.setItem(
            "nextchapter_return_after_auth",
            window.location.href
          );

          window.location.href =
            "/auth";

          return;
        }

        if (isWantToRead) {
          const {
            error,
          } = await supabase
            .from(
              "want_to_read"
            )
            .delete()
            .eq(
              "user_id",
              authData.user.id
            )
            .eq(
              "book_id",
              databaseBookId
            );

          if (error) {
            throw error;
          }

          setIsWantToRead(
            false
          );
        } else {
          const {
            error,
          } = await supabase
            .from(
              "want_to_read"
            )
            .insert({
              user_id:
                authData.user.id,
              book_id:
                databaseBookId,
            });

          if (
            error &&
            error.code !==
              "23505"
          ) {
            throw error;
          }

          setIsWantToRead(
            true
          );
        }
      } catch (error) {
        console.error(
          "Want to Read update error:",
          error
        );

        alert(
          "Could not update Want to Read right now. Please try again."
        );
      } finally {
        setSavingWantToRead(
          false
        );
      }
    };

  const goBack =
    () => {
      if (
        window.history.length >
        1
      ) {
        window.history.back();
        return;
      }

      window.location.href =
        "/";
    };

  const buyQuery =
    encodeURIComponent(
      `${bookTitle} ${bookAuthor}`.trim()
    );

  // -------------------------
  // LOAD RATINGS
  // -------------------------

  const loadRatings =
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
        .from("ratings")
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
          "Load ratings error:",
          error
        );

        return;
      }

      const loadedRatings =
        (data || []) as Rating[];

      setRatings(loadedRatings);

      const myRating =
        loadedRatings.find(
          (rating) =>
            rating.user_id ===
            guestUserId
        );

      if (myRating) {
        setPlotRating(
          myRating.plot_rating
        );
        setCharactersRating(
          myRating.characters_rating
        );
        setPacingRating(
          myRating.pacing_rating
        );
        setWritingRating(
          myRating.writing_rating
        );
        setAtmosphereRating(
          myRating.atmosphere_rating
        );
        setEndingRating(
          myRating.ending_rating
        );
        setOverallRating(
          Number(
            myRating.overall_rating
          )
        );
        setOverallWasEdited(
          myRating.calculated_overall_rating !==
            null &&
            Number(
              myRating.overall_rating
            ) !==
              Number(
                myRating.calculated_overall_rating
              )
        );
        setRatingThought(
          myRating.content || ""
        );
        setRatingSpoiler(
          Boolean(
            myRating.contains_spoilers
          )
        );
      }
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

    loadRatings();
    loadPosts();
  }, [
    databaseBookId,
    guestUserId,
  ]);

  // -------------------------
  // SAVE RATING
  // -------------------------

  const submitRating =
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

      const { error } =
        await supabase
          .from("ratings")
          .upsert(
            {
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
                ratingThought.trim(),
              contains_spoilers:
                ratingSpoiler,
              updated_at:
                new Date().toISOString(),
            },
            {
              onConflict:
                "book_id,user_id",
            }
          );

      if (error) {
        console.error(
          "Save rating error:",
          error
        );

        alert(
          "Could not save rating."
        );

        return;
      }

      await loadRatings();

      alert("Rating saved ");
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

  const toggleSpoiler = (
    id: string
  ) => {
    setRevealedSpoilers(
      (previous) =>
        previous.includes(id)
          ? previous.filter(
              (spoilerId) =>
                spoilerId !== id
            )
          : [...previous, id]
    );
  };

  const spoilerContent = (
    id: string,
    text: string,
    hasSpoiler: boolean
  ) => {
    const revealed =
      revealedSpoilers.includes(id);

    if (!hasSpoiler) {
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
          toggleSpoiler(id)
        }
        className="w-full rounded-2xl border border-[#E6D8D4] bg-[#F6E8E6]/75 px-5 py-5 text-left transition hover:bg-[#EBCFD0]/85"
        aria-expanded={revealed}
      >
        {revealed ? (
          <p className="whitespace-pre-wrap leading-7 text-stone-700">
            {text}
          </p>
        ) : (
          <div className="text-sm font-semibold text-[var(--aepilog-cherry)]">
            Contains spoilers · Tap to reveal
          </div>
        )}
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
    ratings.length > 0
      ? (
          ratings.reduce(
            (
              total,
              rating
            ) =>
              total +
              Number(
                rating.overall_rating
              ),
            0
          ) /
          ratings.length
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
    <main className="min-h-screen overflow-x-hidden bg-[var(--aepilog-cream)] text-stone-900">
      <SiteHeader />
      <div className="mx-auto max-w-5xl px-4 py-5 sm:px-5 sm:py-8 md:py-12">

        {/* BOOK HEADER */}

        <div className="mb-4">
          <button
            type="button"
            onClick={goBack}
            className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-[var(--aepilog-paper)] px-4 py-2 text-sm font-semibold text-[var(--aepilog-cherry)] shadow-sm transition hover:bg-[var(--aepilog-blush-light)]"
          >
            ←{" "}
            {openedFrom ===
            "recommendations"
              ? "Back to recommendations"
              : "Back"}
          </button>
        </div>

        <section className="rounded-[22px] border border-stone-200 bg-[var(--aepilog-paper)] p-4 shadow-sm sm:rounded-[32px] sm:p-6 md:p-8">
          <div className="grid gap-4 sm:gap-6 md:grid-cols-[180px_1fr]">

            <div>
              {(enrichedCover || bookCover) ? (
                <img
                  src={enrichedCover || bookCover || ""}
                  alt={bookTitle}
                  className="mx-auto w-[128px] rounded-xl object-cover shadow-md sm:w-full sm:max-w-[180px] sm:rounded-2xl md:mx-0"
                />
              ) : (
                <div className="mx-auto flex aspect-[2/3] w-[128px] items-center justify-center rounded-xl bg-[var(--aepilog-blush-light)] px-4 text-center text-sm font-semibold text-stone-400 sm:w-full sm:max-w-[180px] sm:rounded-2xl md:mx-0">
                  No cover
                </div>
              )}
            </div>

            <div className="min-w-0">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--aepilog-cherry-soft)]">
                aepilog
              </div>

              <h1 className="aepilog-heading mt-2 text-3xl font-medium tracking-tight md:text-4xl">
                {bookTitle}
              </h1>

              {bookAuthor && (
                <p className="mt-2 text-base text-stone-500">
                  by {bookAuthor}
                </p>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                {bookMeta.publishedDate && (
                  <span className="rounded-full bg-[var(--aepilog-blush-light)] px-3 py-1.5 text-xs font-medium text-stone-600">
                    {bookMeta.publishedDate}
                  </span>
                )}

                {bookMeta.pageCount && (
                  <span className="rounded-full bg-[var(--aepilog-blush-light)] px-3 py-1.5 text-xs font-medium text-stone-600">
                    {bookMeta.pageCount} pages
                  </span>
                )}

                {bookMeta.categories
                  .slice(0, 2)
                  .map(
                    (
                      category
                    ) => (
                      <span
                        key={
                          category
                        }
                        className="rounded-full bg-[var(--aepilog-blush-light)] px-3 py-1.5 text-xs font-medium text-[var(--aepilog-cherry)]"
                      >
                        {category}
                      </span>
                    )
                  )}
              </div>

              <div className="mt-6">
                <div className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--aepilog-cherry-soft)]">
                  About this book
                </div>

                {descriptionLoading ? (
                  <p className="mt-2 text-sm leading-7 text-stone-400">
                    Loading description...
                  </p>
                ) : bookDescription ? (
                  <p className="mt-2 max-w-3xl whitespace-pre-line text-sm leading-7 text-stone-600">
                    {bookDescription}
                  </p>
                ) : (
                  <p className="mt-2 text-sm leading-7 text-stone-500">
                    A description is not available for this edition yet.
                  </p>
                )}
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={
                    toggleWantToRead
                  }
                  disabled={
                    savingWantToRead ||
                    !databaseBookId
                  }
                  className={`rounded-full px-5 py-2.5 text-sm font-semibold transition ${
                    isWantToRead
                      ? "border border-[var(--aepilog-blush)] bg-[var(--aepilog-blush-light)] text-[var(--aepilog-cherry)]"
                      : "bg-[var(--aepilog-cherry)] text-white hover:bg-[var(--aepilog-cherry-hover)]"
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  {savingWantToRead
                    ? "Saving..."
                    : isWantToRead
                    ? "Saved to Want to Read"
                    : "Want to Read"}
                </button>

                <a
                  href={`https://www.amazon.com/s?k=${buyQuery}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-stone-300 bg-white px-5 py-2.5 text-sm font-semibold text-stone-700 transition hover:bg-stone-50"
                >
                  Buy on Amazon
                </a>

                <a
                  href={`https://bookshop.org/search?keywords=${buyQuery}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-[#E6D8D4] bg-[#fffaf0] px-5 py-2.5 text-sm font-semibold text-[#8F2635] transition hover:bg-[#F6E8E6]"
                >
                  Bookshop.org
                </a>
              </div>

              <p className="mt-3 text-xs leading-5 text-stone-400">
                Retailer buttons currently open normal search links. Affiliate tracking can be added later without changing this layout.
              </p>
            </div>
          </div>
        </section>

        {/* TABS */}

        <div className="mt-5 grid grid-cols-2 rounded-2xl border border-stone-200 bg-[var(--aepilog-paper)] p-1 shadow-sm sm:mt-7 sm:p-1.5">

          <button
            type="button"
            onClick={() =>
              setActiveTab(
                "ratings"
              )
            }
            className={`rounded-xl px-5 py-3 font-medium transition ${
              activeTab ===
              "ratings"
                ? "bg-[var(--aepilog-cherry)] text-white shadow-sm"
                : "text-stone-600 hover:bg-stone-100"
            }`}
          >
            Ratings
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
                ? "bg-[var(--aepilog-cherry)] text-white shadow-sm"
                : "text-stone-600 hover:bg-stone-100"
            }`}
          >
            Discussion
          </button>

        </div>

        {loading && (
          <div className="py-20 text-center text-stone-500">
            Opening the
            book...
          </div>
        )}

        {/* RATINGS */}

        {!loading &&
          activeTab ===
            "ratings" && (
            <section className="mt-7">

              <div className="grid gap-6 md:grid-cols-[260px_1fr]">

                {/* READER SCORE */}

                <div className="h-fit rounded-[22px] border border-stone-200 bg-[var(--aepilog-paper)] p-4 shadow-sm sm:rounded-[28px] sm:p-6">

                  <div className="text-sm font-semibold text-stone-500">
                    Reader score
                  </div>

                  <div className="mt-3 flex items-end gap-2">

                    <div className="text-5xl font-semibold text-[var(--aepilog-cherry)]">
                      {averageRating ||
                        "—"}
                    </div>

                    {averageRating && (
                      <div className="pb-1 text-sm text-stone-400">
                        / 5
                      </div>
                    )}

                  </div>

                  <p className="mt-3 text-sm text-stone-500">
                    {ratings.length}{" "}
                    {ratings.length ===
                    1
                      ? "rating"
                      : "ratings"}
                  </p>

                  <p className="mt-5 text-xs leading-5 text-stone-400">
                    Reader score
                    uses each
                    person's final
                    overall rating.
                  </p>

                </div>

                {/* RATE BOOK */}

                <div
                  id="rate-book"
                  className="scroll-mt-28 rounded-[22px] border border-stone-200 bg-[var(--aepilog-paper)] p-4 shadow-sm sm:rounded-[28px] sm:p-6 md:p-7"
                >

                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--aepilog-cherry-soft)]">
                    Your rating
                  </div>

                  <h2 className="aepilog-heading mt-2 text-2xl font-medium">
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
                    adjust it. Add
                    your thoughts
                    too if you want.
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
                                  ? "bg-[var(--aepilog-blush)] text-[var(--aepilog-cherry)]"
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
                            max="5"
                            step="0.5"
                            value={
                              category.value ??
                              3
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
                            className="mt-4 w-full cursor-pointer accent-[var(--aepilog-cherry)]"
                          />

                          <div className="mt-1 flex justify-between text-[10px] text-stone-400">
                            <span>
                              1
                            </span>

                            <span>
                              3
                            </span>

                            <span>
                              5
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

                  <div className="mt-6 rounded-2xl bg-[var(--aepilog-blush-light)] p-5">

                    <div className="text-sm font-semibold text-[var(--aepilog-cherry)]">
                      aepilog
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
                          / 5
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

                        <div className="text-3xl font-semibold text-[var(--aepilog-cherry)]">
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
                            / 5
                          </div>
                        )}

                      </div>

                    </div>

                    <input
                      type="range"
                      min="1"
                      max="5"
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
                        3
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
                      className="mt-5 w-full cursor-pointer accent-[var(--aepilog-cherry)] disabled:cursor-not-allowed disabled:opacity-40"
                    />

                    <div className="mt-1 flex justify-between text-[10px] text-stone-400">
                      <span>
                        1
                      </span>
                      <span>
                        3
                      </span>
                      <span>
                        5
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

                  {/* OPTIONAL THOUGHTS */}

                  <textarea
                    value={
                      ratingThought
                    }
                    onChange={(
                      event
                    ) =>
                      setRatingThought(
                        event
                          .target
                          .value
                      )
                    }
                    placeholder="What did you think of this book? (optional)"
                    className="mt-6 min-h-36 w-full resize-none rounded-2xl border border-stone-200 bg-white p-4 outline-none transition focus:border-[var(--aepilog-cherry)]"
                  />

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-4">

                    <label className="flex cursor-pointer items-center gap-2 text-sm text-stone-600">

                      <input
                        type="checkbox"
                        checked={
                          ratingSpoiler
                        }
                        onChange={(
                          event
                        ) =>
                          setRatingSpoiler(
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
                        submitRating
                      }
                      className="rounded-full bg-[var(--aepilog-cherry)] px-6 py-3 text-sm font-semibold text-white hover:bg-[var(--aepilog-cherry-hover)]"
                    >
                      Done
                    </button>

                  </div>

                </div>
              </div>

              {/* RATING FEED */}

              <div className="mt-7 space-y-4">

                {ratings.length ===
                  0 && (
                  <div className="rounded-[22px] border border-dashed border-stone-300 bg-[var(--aepilog-paper)] px-4 py-8 text-center sm:rounded-[28px] sm:px-6 sm:py-12">

                    <div className="text-3xl">
                      No cover
                    </div>

                    <h3 className="mt-3 font-semibold">
                      No ratings
                      yet
                    </h3>

                    <p className="mt-1 text-sm text-stone-500">
                      Be the first
                      reader to
                      rate this
                      book.
                    </p>

                  </div>
                )}

                {ratings.map(
                  (
                    rating
                  ) => (
                    <article
                      key={
                        rating.id
                      }
                      className="rounded-[22px] border border-stone-200 bg-[var(--aepilog-paper)] p-4 shadow-sm sm:rounded-[28px] sm:p-6"
                    >

                      <div className="flex flex-wrap items-start justify-between gap-3">

                        <div>

                          <button
                            type="button"
                            className="font-semibold hover:underline"
                          >
                            {
                              rating.username
                            }
                          </button>

                          <div className="mt-2 flex items-end gap-2">

                            <span className="text-3xl font-semibold text-[var(--aepilog-cherry)]">
                              {Number(
                                rating.overall_rating
                              ).toFixed(
                                1
                              )}
                            </span>

                            <span className="pb-1 text-sm text-stone-400">
                              / 5
                            </span>

                          </div>

                        </div>

                        <div className="text-xs text-stone-400">
                          {formatDate(
                            rating.created_at
                          )}
                        </div>

                      </div>

                      {rating.content && (
                        <div className="mt-5">
                          {spoilerContent(
                            `rating-${rating.id}`,
                            rating.content,
                            rating.contains_spoilers
                          )}
                        </div>
                      )}

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
                              rating.plot_rating,
                            ],
                            [
                              "Characters",
                              rating.characters_rating,
                            ],
                            [
                              "Pacing",
                              rating.pacing_rating,
                            ],
                            [
                              "Writing",
                              rating.writing_rating,
                            ],
                            [
                              "Atmosphere",
                              rating.atmosphere_rating,
                            ],
                            [
                              "Ending",
                              rating.ending_rating,
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
                                className="rounded-xl bg-[var(--aepilog-blush-light)] px-3 py-2"
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
                                      )}/5`
                                    : "—"}
                                </div>

                              </div>
                            )
                          )}

                        </div>

                      </div>

                      {/* CALCULATED VS FINAL */}

                      {rating.calculated_overall_rating !==
                        null && (
                        <div className="mt-4 text-xs text-stone-400">
                          Calculated
                          score:{" "}
                          {Number(
                            rating.calculated_overall_rating
                          ).toFixed(
                            1
                          )}
                          /5
                          {Number(
                            rating.calculated_overall_rating
                          ) !==
                            Number(
                              rating.overall_rating
                            ) &&
                            " · Reader adjusted their overall score"}
                        </div>
                      )}

                      <div className="mt-4">

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            rating.contains_spoilers
                              ? "bg-amber-100 text-amber-800"
                              : "bg-[var(--aepilog-blush)] text-[#8F2635]"
                          }`}
                        >
                          {rating.contains_spoilers
                            ? " Contains spoilers"
                            : " Spoiler-free"}
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

              <div className="rounded-[22px] border border-stone-200 bg-[var(--aepilog-paper)] p-4 shadow-sm sm:rounded-[28px] sm:p-6 md:p-7">

                <div className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--aepilog-cherry-soft)]">
                  Book Club
                </div>

                <h2 className="aepilog-heading mt-2 text-2xl font-medium">
                  Talk about
                  this book
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
                  className="mt-5 min-h-36 w-full resize-none rounded-2xl border border-stone-200 bg-white p-4 outline-none transition focus:border-[var(--aepilog-cherry)]"
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
                    className="rounded-full bg-[var(--aepilog-cherry)] px-6 py-3 text-sm font-semibold text-white hover:bg-[var(--aepilog-cherry-hover)]"
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
                          ? "bg-[var(--aepilog-cherry)] text-white"
                          : "border border-stone-200 bg-[var(--aepilog-paper)] text-stone-600"
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
                  <div className="rounded-[22px] border border-dashed border-stone-300 bg-[var(--aepilog-paper)] px-4 py-8 text-center sm:rounded-[28px] sm:px-6 sm:py-12">

                    <div className="text-3xl">

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
                        className="rounded-[22px] border border-stone-200 bg-[var(--aepilog-paper)] p-4 shadow-sm sm:rounded-[28px] sm:p-6"
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
                                    : "bg-[var(--aepilog-blush)] text-[#8F2635]"
                                }`}
                              >
                                {post.contains_spoilers
                                  ? " Contains spoilers"
                                  : " Spoiler-free"}
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
                              ? "Liked"
                              : "Like"}{" "}
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
                            {" "}
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

                                      <div className="rounded-2xl bg-[var(--aepilog-blush-light)] p-4">

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
                                            className="ml-7 mt-2 rounded-2xl border-l-2 border-[#E6D8D4] bg-stone-50 p-4"
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
                              <div className="mt-5 flex items-center justify-between rounded-xl bg-[var(--aepilog-blush-light)] px-3 py-2 text-xs text-[var(--aepilog-cherry)]">

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
                              className="mt-4 min-h-24 w-full resize-none rounded-2xl border border-stone-200 bg-white p-3 text-sm outline-none focus:border-[var(--aepilog-cherry)]"
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
                                className="rounded-full bg-[var(--aepilog-cherry)] px-5 py-2 text-sm font-semibold text-white"
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
          .
        </div>

      </div>
    </main>
  );
}

export default function BookPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[var(--aepilog-cream)] flex items-center justify-center">
          <p className="text-[var(--aepilog-cherry)] font-semibold">
            Opening book...
          </p>
        </main>
      }
    >
      <BookPageContent />
    </Suspense>
  );
}