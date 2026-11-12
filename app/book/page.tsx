"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { discussionHref } from "@/lib/discussion-links";
import SiteHeader from "../components/SiteHeader";
import AnimatedLikeButton from "../components/AnimatedLikeButton";
import { ReaderName } from "../components/ReaderSocial";
import BookShareButton from "../components/BookShareButton";
import { supabase } from "@/lib/supabase";
import { loadBookDiscussions } from "@/lib/book-discussions";

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
  user_id: string;
  username: string;
  content: string;
  contains_spoilers: boolean;
  created_at: string;
  likes: number;
  comments: number;
  likedByMe: boolean;
  book_polls?: { post_id: string } | { post_id: string }[] | null;
};



type RatingValue =
  | number
  | null;

function BookPageContent() {
  const router = useRouter();
  const searchParams =
    useSearchParams();

  const bookExternalId =
    searchParams.get("book") ||
    searchParams.get("id") ||
    "";

  const bookTitle =
    searchParams.get("title") ||
    "";

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
        if (!bookTitle) {
          setDescriptionLoading(false);
          return;
        }
        setDescriptionLoading(
          true
        );

        try {
          const response =
            await fetch(
              `/api/book/details?title=${encodeURIComponent(
                bookTitle
              )}&author=${encodeURIComponent(
                bookAuthor
              )}`,
              {
                cache:
                  "no-store",
              }
            );

          if (!response.ok) throw new Error("Book details request failed");
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

      if (authUser && !authUser.is_anonymous) {
        const username =
          typeof authUser.user_metadata?.username === "string" &&
          authUser.user_metadata.username.trim()
            ? authUser.user_metadata.username.trim()
            : "Reader";

        localStorage.setItem("nextchapter_guest_id", authUser.id);
        localStorage.setItem("nextchapter_guest_username", username);

        if (!cancelled) {
          setGuestUserId(authUser.id);
          setGuestUsername(username);
        }
        return;
      }

      localStorage.removeItem("nextchapter_guest_id");
      localStorage.removeItem("nextchapter_guest_username");

      if (!cancelled) {
        setGuestUserId("");
        setGuestUsername("");
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
        if (!bookExternalId || !bookTitle) {
          setLoading(false);
          return;
        }
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
          !authData.user || authData.user.is_anonymous
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

        if (
          !authData.user || authData.user.is_anonymous
        ) {
          sessionStorage.setItem(
            "nextchapter_return_after_auth",
            window.location.href
          );

          window.location.href =
            "/auth";

          return;
        }
        if (authError) throw authError;

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

  const postLoadVersion = useRef(0);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsError, setPostsError] = useState("");
  const [likingPost, setLikingPost] = useState<string | null>(null);
  const [likeError, setLikeError] = useState<{ id: string; message: string } | null>(null);

  const loadPosts = async () => {
    if (!databaseBookId) return;
    const version = ++postLoadVersion.current;
    setPostsLoading(true); setPostsError("");
    try {
      const rows = await loadBookDiscussions(databaseBookId, guestUserId || null);
      if (version === postLoadVersion.current) setPosts(rows as unknown as DiscussionPost[]);
    } catch {
      if (version === postLoadVersion.current) setPostsError("Could not load discussions. Please try again.");
    } finally {
      if (version === postLoadVersion.current) setPostsLoading(false);
    }
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

  function requireAccount() {
    if (guestUserId && guestUsername) {
      return true;
    }

    sessionStorage.setItem(
      "nextchapter_return_after_auth",
      window.location.href
    );
    window.location.href = "/auth";
    return false;
  }

  // -------------------------
  // SAVE RATING
  // -------------------------

  const submitRating =
    async () => {
      if (!requireAccount()) {
        return;
      }

      if (!databaseBookId) {
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
      if (!requireAccount()) {
        return;
      }

      if (
        !databaseBookId ||
        !postText.trim()
      ) {
        return;
      }

      const { data: newPost, error } = await supabase
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
        }).select("id").single();

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

      if (newPost?.id) router.push(discussionHref(newPost.id));
      else await loadPosts();
    };

  // -------------------------
  // LIKES
  // -------------------------

  const toggleLike = async (postId: string) => {
    if (!requireAccount() || likingPost) return;
    setLikingPost(postId); setLikeError(null);
    try {
      const signal = AbortSignal.timeout(10000);
      const existing = await supabase.from("discussion_likes").select("id")
        .eq("post_id", postId).eq("user_id", guestUserId).abortSignal(signal).maybeSingle();
      if (existing.error) throw existing.error;
      const result = existing.data?.id
        ? await supabase.from("discussion_likes").delete().eq("id", existing.data.id).abortSignal(signal)
        : await supabase.from("discussion_likes").insert({ post_id: postId, user_id: guestUserId }).abortSignal(signal);
      if (result.error) throw result.error;
      setPosts((current) => current.map((post) => post.id === postId ? { ...post,
        likedByMe: !existing.data?.id, likes: Math.max(0, post.likes + (existing.data?.id ? -1 : 1)) } : post));
    } catch { setLikeError({ id: postId, message: "Could not save your like. Please try again." }); }
    finally { setLikingPost(null); }
  };

  // -------------------------
  // COMMENTS
  // -------------------------







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
        className="w-full rounded-2xl border border-[#aebaa5] bg-[#e7eee2]/75 px-5 py-5 text-left transition hover:bg-[#dfe9d9]/85"
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

  if (!bookExternalId || !bookTitle) {
    return (
      <main className="min-h-screen bg-[var(--aepilog-cream)] text-stone-900">
        <SiteHeader />
        <div className="mx-auto max-w-5xl px-5 py-12">
          <h1 className="aepilog-heading text-3xl">Choose a book first</h1>
          <a href="/search" className="mt-4 inline-block font-semibold text-[var(--aepilog-cherry)]">Search for a book</a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--aepilog-cream)] text-stone-900">
      <SiteHeader />
      <div className="mx-auto max-w-5xl px-5 py-8 md:py-12">

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

        <section className="rounded-[32px] border border-stone-200 bg-[var(--aepilog-paper)] p-6 shadow-sm md:p-8">
          <div className="grid gap-6 md:grid-cols-[180px_1fr]">

            <div>
              {(enrichedCover || bookCover) ? (
                <img
                  src={enrichedCover || bookCover || ""}
                  alt={bookTitle}
                  className="w-full max-w-[180px] rounded-2xl object-cover shadow-md"
                />
              ) : (
                <div className="flex aspect-[2/3] w-full max-w-[180px] items-center justify-center rounded-2xl bg-[var(--aepilog-blush-light)] px-4 text-center text-sm font-semibold text-stone-400">
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

              <div className="mt-4"><BookShareButton book={{ title: bookTitle, author: bookAuthor, cover: enrichedCover || bookCover, href: `/book?${new URLSearchParams({ book: bookExternalId, title: bookTitle, author: bookAuthor, ...(enrichedCover || bookCover ? { cover: enrichedCover || bookCover } : {}) })}` }} rating={ratings.find((item) => item.user_id === guestUserId)?.overall_rating} readerName={guestUsername} /></div>

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
                  className="rounded-full border border-[#c9b899] bg-[#fffaf0] px-5 py-2.5 text-sm font-semibold text-[#715936] transition hover:bg-[#f7efe1]"
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

        <div className="mt-7 grid grid-cols-2 rounded-2xl border border-stone-200 bg-[var(--aepilog-paper)] p-1.5 shadow-sm">

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

                <div className="h-fit rounded-[28px] border border-stone-200 bg-[var(--aepilog-paper)] p-6 shadow-sm">

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
                  className="scroll-mt-28 rounded-[28px] border border-stone-200 bg-[var(--aepilog-paper)] p-6 shadow-sm md:p-7"
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
                  <div className="rounded-[28px] border border-dashed border-stone-300 bg-[var(--aepilog-paper)] px-6 py-12 text-center">

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
                      className="rounded-[28px] border border-stone-200 bg-[var(--aepilog-paper)] p-6 shadow-sm"
                    >

                      <div className="flex flex-wrap items-start justify-between gap-3">

                        <div>

                          <ReaderName userId={rating.user_id} name={rating.username} className="font-medium" />

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
                              : "bg-[var(--aepilog-blush)] text-[#506246]"
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

              <div className="rounded-[28px] border border-stone-200 bg-[var(--aepilog-paper)] p-6 shadow-sm md:p-7">

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

                {postsLoading && <p role="status" className="text-sm text-stone-500">Loading discussions...</p>}
                {postsError && <p role="alert" className="text-sm text-[#8f2635]">{postsError} <button type="button" onClick={() => void loadPosts()} className="underline">Try again</button></p>}
                {!postsLoading && !postsError && filteredPosts.length ===
                  0 && (
                  <div className="rounded-[28px] border border-dashed border-stone-300 bg-[var(--aepilog-paper)] px-6 py-12 text-center">

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




                    return (
                      <article
                        key={
                          post.id
                        }
                        className="rounded-[28px] border border-stone-200 bg-[var(--aepilog-paper)] p-6 shadow-sm"
                      >

                        <div className="flex flex-wrap items-start justify-between gap-3">

                          <div>

                            <ReaderName userId={post.user_id} name={post.username} className="font-medium" />

                            <div className="mt-2">

                              <span
                                className={`rounded-full px-3 py-1 text-xs font-medium ${
                                  post.contains_spoilers
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-[var(--aepilog-blush)] text-[#506246]"
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
                          {post.contains_spoilers ? spoilerContent(`post-${post.id}`, post.content, true) : <Link href={discussionHref(post.id)} className="block"><p className="line-clamp-4 whitespace-pre-wrap break-words leading-7 text-stone-700">{post.content}</p><span className="mt-2 inline-block text-xs font-medium text-[#8f2635]">Read discussion →</span></Link>}
                        </div>

                        {post.book_polls && (!Array.isArray(post.book_polls) || post.book_polls.length > 0) && <Link href={discussionHref(post.id)} className="mt-4 inline-block rounded-full border border-[#e6d8d4] px-4 py-2 text-sm font-semibold text-[#8f2635]">View book poll →</Link>}

                        <div className="mt-5 flex items-center gap-5 border-t border-stone-100 pt-4">

                          <AnimatedLikeButton
                            liked={post.likedByMe}
                            disabled={!!likingPost}
                            aria-busy={likingPost === post.id}
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
                          </AnimatedLikeButton>

                          <Link href={discussionHref(post.id)} className="text-sm font-medium text-stone-500">
                            {post.comments} {post.comments === 1 ? "comment" : "comments"}
                          </Link>

                        </div>

                        {likeError?.id === post.id && <p role="alert" className="mt-2 text-sm text-[#8f2635]">{likeError.message}</p>}

                        {/* COMMENTS */}



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

function BookPageEntry() {
  const params = useSearchParams();
  // A different book starts with fresh rating/draft/cover state on client navigation.
  return <BookPageContent key={params.get("book") || params.get("id") || params.get("title") || "missing"} />;
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
      <BookPageEntry />
    </Suspense>
  );
}
