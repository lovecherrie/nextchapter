"use client";

import { useEffect, useMemo, useState } from "react";
import SiteHeader from "../components/SiteHeader";
import { supabase } from "@/lib/supabase";

type Book = {
  id: string;
  external_id: string;
  title: string;
  author: string;
  cover_url: string | null;
};

type BookSearchResult = {
  id: string;
  title: string;
  author: string;
  cover?: string | null;
};

type TopBook = {
  id: string;
  user_id: string;
  book_id: string;
  position: number;
  books: Book | null;
};

type WantToReadItem = {
  id: string;
  user_id: string;
  book_id: string;
  created_at: string;
  books: Book | null;
};

type DraftTopBook = {
  external_id: string;
  title: string;
  author: string;
  cover_url: string | null;
};

type Rating = {
  id: string;
  book_id: string;
  user_id: string;
  username: string;
  overall_rating: number;
  content: string | null;
  contains_spoilers: boolean;
  created_at: string;
  books: Book | null;
};

type DiscussionPost = {
  id: string;
  book_id: string;
  user_id: string;
  username: string;
  content: string;
  contains_spoilers: boolean;
  created_at: string;
  books: Book | null;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function bookHref(book: Book) {
  const params = new URLSearchParams({
    book: book.external_id,
    title: book.title,
    author: book.author || "",
    cover: book.cover_url || "",
  });

  return `/book?${params.toString()}`;
}

export default function ProfilePage() {
  const [userId, setUserId] = useState("");
  const [username, setUsername] = useState("Bookworm");
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [posts, setPosts] = useState<DiscussionPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [topBooks, setTopBooks] = useState<TopBook[]>([]);
  const [wantToRead, setWantToRead] = useState<WantToReadItem[]>([]);
  const [topBooksOpen, setTopBooksOpen] = useState(false);
  const [draftTopBooks, setDraftTopBooks] = useState<(DraftTopBook | null)[]>([
    null,
    null,
    null,
    null,
  ]);
  const [activeTopBookSlot, setActiveTopBookSlot] = useState(0);
  const [topBookQuery, setTopBookQuery] = useState("");
  const [topBookResults, setTopBookResults] = useState<BookSearchResult[]>([]);
  const [searchingTopBooks, setSearchingTopBooks] = useState(false);
  const [savingTopBooks, setSavingTopBooks] = useState(false);
  const [topBooksError, setTopBooksError] = useState("");

  const [bio, setBio] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [draftUsername, setDraftUsername] = useState("");
  const [draftBio, setDraftBio] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");

  useEffect(() => {
    initializeProfile();
  }, []);

  useEffect(() => {
    if (!topBooksOpen || topBookQuery.trim().length < 2) {
      setTopBookResults([]);
      setSearchingTopBooks(false);
      return;
    }

    const timer = window.setTimeout(async () => {
      setSearchingTopBooks(true);

      try {
        const response = await fetch(
          `/api/books/search?q=${encodeURIComponent(topBookQuery.trim())}`
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Book search failed");
        }

        setTopBookResults(data.books || []);
      } catch (searchError) {
        console.error("Top 4 book search error:", searchError);
        setTopBookResults([]);
      } finally {
        setSearchingTopBooks(false);
      }
    }, 350);

    return () => window.clearTimeout(timer);
  }, [topBookQuery, topBooksOpen]);

  async function initializeProfile() {
    setLoading(true);
    setError("");

    const savedGuestId =
      localStorage.getItem("nextchapter_guest_id") || "";
    const savedUsername =
      localStorage.getItem("nextchapter_guest_username") ||
      "Bookworm";
    const savedBio =
      localStorage.getItem("nextchapter_profile_bio") || "";

    try {
      const { data, error: authError } =
        await supabase.auth.getUser();

      if (authError) {
        throw authError;
      }

      const authUser = data.user;

      if (!authUser) {
        window.location.href = "/auth";
        return;
      }

      const accountUsername =
        typeof authUser.user_metadata?.username === "string" &&
        authUser.user_metadata.username.trim()
          ? authUser.user_metadata.username.trim()
          : savedUsername;

      // Move activity created before signup from the temporary guest id
      // to the real Supabase account id.
      if (savedGuestId && savedGuestId !== authUser.id) {
        const migrationResults = await Promise.all([
          supabase
            .from("ratings")
            .update({
              user_id: authUser.id,
              username: accountUsername,
            })
            .eq("user_id", savedGuestId),
          supabase
            .from("discussion_posts")
            .update({
              user_id: authUser.id,
              username: accountUsername,
            })
            .eq("user_id", savedGuestId),
          supabase
            .from("comments")
            .update({
              user_id: authUser.id,
              username: accountUsername,
            })
            .eq("user_id", savedGuestId),
          supabase
            .from("discussion_likes")
            .update({ user_id: authUser.id })
            .eq("user_id", savedGuestId),
        ]);

        const migrationError = migrationResults.find(
          (result) => result.error
        )?.error;

        if (migrationError) {
          console.error(
            "Guest activity migration error:",
            migrationError
          );
        }
      }

      // The rest of NextChapter already reads these localStorage keys.
      // Reusing them means new ratings/posts/comments/likes automatically
      // use the logged-in account id without changing those pages yet.
      localStorage.setItem(
        "nextchapter_guest_id",
        authUser.id
      );
      localStorage.setItem(
        "nextchapter_guest_username",
        accountUsername
      );

      setUserId(authUser.id);
      setUsername(accountUsername);
      setBio(savedBio);
      setDraftUsername(accountUsername);
      setDraftBio(savedBio);

      await loadProfile(authUser.id);
    } catch (initializeError) {
      console.error(
        "Profile initialization error:",
        initializeError
      );
      setError(
        "Could not connect your account to your profile right now."
      );
      setLoading(false);
    }
  }

  async function loadProfile(currentUserId: string) {
    setLoading(true);
    setError("");

    try {
      const [ratingsResult, postsResult, topBooksResult, wantToReadResult] = await Promise.all([
        supabase
          .from("ratings")
          .select(`
            id,
            book_id,
            user_id,
            username,
            overall_rating,
            content,
            contains_spoilers,
            created_at,
            books (
              id,
              external_id,
              title,
              author,
              cover_url
            )
          `)
          .eq("user_id", currentUserId)
          .order("created_at", { ascending: false }),

        supabase
          .from("discussion_posts")
          .select(`
            id,
            book_id,
            user_id,
            username,
            content,
            contains_spoilers,
            created_at,
            books (
              id,
              external_id,
              title,
              author,
              cover_url
            )
          `)
          .eq("user_id", currentUserId)
          .order("created_at", { ascending: false }),

        supabase
          .from("profile_top_books")
          .select(`
            id,
            user_id,
            book_id,
            position,
            books (
              id,
              external_id,
              title,
              author,
              cover_url
            )
          `)
          .eq("user_id", currentUserId)
          .order("position", { ascending: true }),

        supabase
          .from("want_to_read")
          .select(`
            id,
            user_id,
            book_id,
            created_at,
            books (
              id,
              external_id,
              title,
              author,
              cover_url
            )
          `)
          .eq("user_id", currentUserId)
          .order("created_at", { ascending: false }),
      ]);

      if (ratingsResult.error) {
        throw ratingsResult.error;
      }

      if (postsResult.error) {
        throw postsResult.error;
      }

      if (topBooksResult.error) {
        throw topBooksResult.error;
      }

      if (wantToReadResult.error) {
        throw wantToReadResult.error;
      }

      setRatings((ratingsResult.data || []) as unknown as Rating[]);
      setPosts((postsResult.data || []) as unknown as DiscussionPost[]);
      setTopBooks((topBooksResult.data || []) as unknown as TopBook[]);
      setWantToRead((wantToReadResult.data || []) as unknown as WantToReadItem[]);
    } catch (profileError) {
      console.error("Profile load error:", profileError);
      setError("Could not load your profile activity right now.");
    } finally {
      setLoading(false);
    }
  }

  function openTopBooksEditor() {
    const nextDraft: (DraftTopBook | null)[] = [null, null, null, null];

    topBooks.forEach((item) => {
      if (item.books && item.position >= 1 && item.position <= 4) {
        nextDraft[item.position - 1] = {
          external_id: item.books.external_id,
          title: item.books.title,
          author: item.books.author || "",
          cover_url: item.books.cover_url,
        };
      }
    });

    setDraftTopBooks(nextDraft);
    setActiveTopBookSlot(0);
    setTopBookQuery("");
    setTopBookResults([]);
    setTopBooksError("");
    setTopBooksOpen(true);
  }

  function closeTopBooksEditor() {
    if (savingTopBooks) return;

    setTopBooksOpen(false);
    setTopBookQuery("");
    setTopBookResults([]);
    setTopBooksError("");
  }

  function chooseTopBook(book: BookSearchResult) {
    const isAlreadyChosen = draftTopBooks.some(
      (item, index) => item?.external_id === book.id && index !== activeTopBookSlot
    );

    if (isAlreadyChosen) {
      setTopBooksError("That book is already in your Top 4.");
      return;
    }

    setDraftTopBooks((current) => {
      const next = [...current];
      next[activeTopBookSlot] = {
        external_id: book.id,
        title: book.title,
        author: book.author || "",
        cover_url: book.cover || null,
      };
      return next;
    });

    setTopBookQuery("");
    setTopBookResults([]);
    setTopBooksError("");

    if (activeTopBookSlot < 3) {
      setActiveTopBookSlot(activeTopBookSlot + 1);
    }
  }

  function removeDraftTopBook(index: number) {
    setDraftTopBooks((current) => {
      const next = [...current];
      next[index] = null;
      return next;
    });
    setActiveTopBookSlot(index);
    setTopBooksError("");
  }

  async function ensureDatabaseBook(book: DraftTopBook) {
    const { data: existingBook, error: lookupError } = await supabase
      .from("books")
      .select("id, external_id, title, author, cover_url")
      .eq("external_id", book.external_id)
      .maybeSingle();

    if (lookupError) throw lookupError;
    if (existingBook) return existingBook as Book;

    const { data: createdBook, error: createError } = await supabase
      .from("books")
      .insert({
        external_id: book.external_id,
        title: book.title,
        author: book.author || null,
        cover_url: book.cover_url || null,
      })
      .select("id, external_id, title, author, cover_url")
      .single();

    if (createError) {
      // If another request created the same book first, fetch it instead.
      const { data: retryBook, error: retryError } = await supabase
        .from("books")
        .select("id, external_id, title, author, cover_url")
        .eq("external_id", book.external_id)
        .maybeSingle();

      if (retryError || !retryBook) throw createError;
      return retryBook as Book;
    }

    return createdBook as Book;
  }

  async function saveTopBooks() {
    if (!userId) return;

    const chosenBooks = draftTopBooks
      .map((book, index) => ({ book, position: index + 1 }))
      .filter(
        (item): item is { book: DraftTopBook; position: number } =>
          item.book !== null
      );

    setSavingTopBooks(true);
    setTopBooksError("");

    try {
      const databaseBooks = await Promise.all(
        chosenBooks.map((item) => ensureDatabaseBook(item.book))
      );

      const { error: deleteError } = await supabase
        .from("profile_top_books")
        .delete()
        .eq("user_id", userId);

      if (deleteError) throw deleteError;

      if (chosenBooks.length > 0) {
        const rows = chosenBooks.map((item, index) => ({
          user_id: userId,
          book_id: databaseBooks[index].id,
          position: item.position,
        }));

        const { error: insertError } = await supabase
          .from("profile_top_books")
          .insert(rows);

        if (insertError) throw insertError;
      }

      const { data: refreshedTopBooks, error: refreshError } = await supabase
        .from("profile_top_books")
        .select(`
          id,
          user_id,
          book_id,
          position,
          books (
            id,
            external_id,
            title,
            author,
            cover_url
          )
        `)
        .eq("user_id", userId)
        .order("position", { ascending: true });

      if (refreshError) throw refreshError;

      setTopBooks((refreshedTopBooks || []) as unknown as TopBook[]);
      setTopBooksOpen(false);
      setTopBookQuery("");
      setTopBookResults([]);
    } catch (saveError) {
      console.error("Top 4 save error:", saveError);
      setTopBooksError("Could not save your Top 4 right now. Please try again.");
    } finally {
      setSavingTopBooks(false);
    }
  }

  async function removeWantToRead(
    itemId: string
  ) {
    const {
      error,
    } = await supabase
      .from("want_to_read")
      .delete()
      .eq("id", itemId)
      .eq("user_id", userId);

    if (error) {
      console.error(
        "Want to Read remove error:",
        error
      );

      setError(
        "Could not remove that book right now."
      );

      return;
    }

    setWantToRead(
      (current) =>
        current.filter(
          (item) =>
            item.id !== itemId
        )
    );
  }

  const writtenReviews = useMemo(
    () =>
      ratings.filter(
        (rating) => (rating.content || "").trim().length > 0
      ),
    [ratings]
  );

  function openEditProfile() {
    setDraftUsername(username);
    setDraftBio(bio);
    setProfileError("");
    setEditOpen(true);
  }

  function closeEditProfile() {
    if (savingProfile) return;

    setEditOpen(false);
    setProfileError("");
  }

  async function saveProfile() {
    const cleanUsername = draftUsername.trim();
    const cleanBio = draftBio.trim();

    if (!cleanUsername) {
      setProfileError("Your display name cannot be empty.");
      return;
    }

    if (cleanUsername.length > 24) {
      setProfileError("Keep your display name to 24 characters or fewer.");
      return;
    }

    if (cleanBio.length > 160) {
      setProfileError("Keep your bio to 160 characters or fewer.");
      return;
    }

    setSavingProfile(true);
    setProfileError("");

    try {
      if (userId && cleanUsername !== username) {
        const [
          ratingsUpdate,
          postsUpdate,
          commentsUpdate,
          authUpdate,
        ] = await Promise.all([
          supabase
            .from("ratings")
            .update({ username: cleanUsername })
            .eq("user_id", userId),
          supabase
            .from("discussion_posts")
            .update({ username: cleanUsername })
            .eq("user_id", userId),
          supabase
            .from("comments")
            .update({ username: cleanUsername })
            .eq("user_id", userId),
          supabase.auth.updateUser({
            data: { username: cleanUsername },
          }),
        ]);

        const updateError =
          ratingsUpdate.error ||
          postsUpdate.error ||
          commentsUpdate.error ||
          authUpdate.error;

        if (updateError) {
          throw updateError;
        }
      }

      localStorage.setItem(
        "nextchapter_guest_username",
        cleanUsername
      );
      localStorage.setItem(
        "nextchapter_profile_bio",
        cleanBio
      );

      setUsername(cleanUsername);
      setBio(cleanBio);

      setRatings((current) =>
        current.map((rating) => ({
          ...rating,
          username: cleanUsername,
        }))
      );

      setPosts((current) =>
        current.map((post) => ({
          ...post,
          username: cleanUsername,
        }))
      );

      setEditOpen(false);
    } catch (saveError) {
      console.error("Profile save error:", saveError);
      setProfileError(
        "Could not save your profile right now. Please try again."
      );
    } finally {
      setSavingProfile(false);
    }
  }


  async function logOut() {
    const { error: signOutError } =
      await supabase.auth.signOut();

    if (signOutError) {
      setError(
        "Could not log out right now. Please try again."
      );
      return;
    }

    window.location.href = "/auth";
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f7f2e8] text-stone-900">
      <SiteHeader active="profile" />

      <div className="mx-auto max-w-5xl px-4 py-5 sm:px-5 sm:py-8 md:py-12">
        <section className="rounded-[22px] border border-stone-200 bg-[#fffdf8] p-4 shadow-sm sm:rounded-[32px] sm:p-6 md:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#EBCFD0] text-xl font-semibold text-[#8F2635]">
                {username.slice(0, 1).toUpperCase()}
              </div>

              <div>
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#B65A65]">
                  Reader profile
                </div>

                <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
                  {username}
                </h1>

                <p className="mt-1 max-w-xl text-sm leading-6 text-stone-500">
                  {bio || "Your reading life on aepilog."}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 self-start">
              <button
                type="button"
                onClick={openEditProfile}
                className="rounded-xl border border-[#E6D8D4] bg-[#F6E8E6] px-4 py-2 text-sm font-semibold text-[#8F2635] transition hover:bg-[#EBCFD0]"
              >
                Edit profile
              </button>

              <button
                type="button"
                onClick={logOut}
                className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-500 transition hover:bg-stone-50 hover:text-stone-700"
              >
                Log out
              </button>
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-[22px] border border-stone-200 bg-[#fffdf8] p-4 sm:mt-6 sm:rounded-[28px] sm:p-6 md:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#B65A65]">
                Your taste
              </div>
              <h2 className="mt-1 text-xl font-semibold">Top 4</h2>
              <p className="mt-1 text-sm text-stone-500">
                The four books that say the most about you.
              </p>
            </div>

            <button
              type="button"
              onClick={openTopBooksEditor}
              className="shrink-0 rounded-xl border border-[#E6D8D4] bg-[#F6E8E6] px-4 py-2 text-sm font-semibold text-[#8F2635] transition hover:bg-[#EBCFD0]"
            >
              {topBooks.length > 0 ? "Edit Top 4" : "Choose Top 4"}
            </button>
          </div>

          {loading ? (
            <p className="mt-5 text-sm text-stone-500">Loading your Top 4...</p>
          ) : (
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[1, 2, 3, 4].map((position) => {
                const item = topBooks.find((book) => book.position === position);

                if (!item?.books) {
                  return (
                    <button
                      key={position}
                      type="button"
                      onClick={openTopBooksEditor}
                      className="group aspect-[2/3] rounded-2xl border border-dashed border-[#E6D8D4] bg-[#F6E8E6]/45 p-4 text-center transition hover:bg-[#F6E8E6]"
                    >
                      <div className="flex h-full flex-col items-center justify-center">
                        <div className="text-xs font-bold uppercase tracking-[0.14em] text-[#B65A65]">
                          #{position}
                        </div>
                        <div className="mt-2 text-sm font-semibold text-[#8F2635]">
                          Add a favorite
                        </div>
                      </div>
                    </button>
                  );
                }

                return (
                  <a
                    key={item.id}
                    href={bookHref(item.books)}
                    className="group min-w-0"
                  >
                    <div className="relative aspect-[2/3] overflow-hidden rounded-2xl bg-[#eee8dc] shadow-sm transition duration-200 group-hover:-translate-y-1 group-hover:shadow-md">
                      {item.books.cover_url ? (
                        <img
                          src={item.books.cover_url}
                          alt={item.books.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center px-3 text-center text-xs font-medium text-stone-400">
                          No cover
                        </div>
                      )}
                      <div className="absolute left-2 top-2 rounded-full bg-[#fffdf8]/90 px-2 py-1 text-[10px] font-bold text-[#8F2635] shadow-sm backdrop-blur">
                        #{position}
                      </div>
                    </div>
                    <div className="mt-2 truncate text-sm font-semibold text-stone-800">
                      {item.books.title}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-stone-500">
                      {item.books.author || "Unknown author"}
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-4 rounded-[22px] border border-stone-200 bg-[#fffdf8] p-4 sm:mt-6 sm:rounded-[28px] sm:p-6 md:p-7">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#B65A65]">
                Your shelf
              </div>
              <h2 className="mt-1 text-xl font-semibold">
                Want to Read
              </h2>
              <p className="mt-1 text-sm text-stone-500">
                Books you saved from recommendations and book pages.
              </p>
            </div>

            {!loading && (
              <div className="rounded-full bg-[#F6E8E6] px-3 py-1.5 text-xs font-bold text-[#8F2635]">
                {wantToRead.length}
              </div>
            )}
          </div>

          {loading ? (
            <p className="mt-5 text-sm text-stone-500">
              Loading your saved books...
            </p>
          ) : wantToRead.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-[#E6D8D4] bg-[#F6E8E6]/60 px-5 py-8 text-center">
              <p className="text-sm font-medium text-[#8F2635]">
                Books you save as Want to Read will show up here.
              </p>
            </div>
          ) : (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {wantToRead.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-4 rounded-2xl border border-stone-200 bg-white p-4"
                >
                  <a
                    href={
                      item.books
                        ? bookHref(item.books)
                        : "#"
                    }
                    className="flex min-w-0 flex-1 items-center gap-4"
                  >
                    <div className="h-24 w-16 shrink-0 overflow-hidden rounded-lg bg-[#eee8dc]">
                      {item.books?.cover_url ? (
                        <img
                          src={item.books.cover_url}
                          alt={item.books.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center px-2 text-center text-[10px] text-stone-400">
                          No cover
                        </div>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="truncate font-semibold text-stone-800">
                        {item.books?.title || "Book"}
                      </div>
                      <div className="mt-1 truncate text-sm text-stone-500">
                        {item.books?.author || "Unknown author"}
                      </div>
                    </div>
                  </a>

                  <button
                    type="button"
                    onClick={() =>
                      removeWantToRead(
                        item.id
                      )
                    }
                    className="shrink-0 rounded-full border border-stone-200 px-3 py-2 text-xs font-semibold text-stone-500 transition hover:bg-stone-50 hover:text-stone-700"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-4 grid grid-cols-3 gap-2 sm:mt-6 sm:gap-4">
          <div className="rounded-2xl border border-stone-200 bg-white p-5">
            <div className="text-2xl font-semibold text-[#8F2635]">
              {loading ? "—" : ratings.length}
            </div>
            <div className="mt-1 text-sm text-stone-500">
              Books rated
            </div>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-5">
            <div className="text-2xl font-semibold text-[#8F2635]">
              {loading ? "—" : posts.length}
            </div>
            <div className="mt-1 text-sm text-stone-500">
              Posts
            </div>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-5">
            <div className="text-2xl font-semibold text-[#8F2635]">
              {loading ? "—" : writtenReviews.length}
            </div>
            <div className="mt-1 text-sm text-stone-500">
              Reviews
            </div>
          </div>
        </section>

        {error && (
          <div className="mt-6 rounded-2xl border border-[#d6b5ad] bg-[#f8ebe7] px-5 py-4 text-sm text-[#8a4f43]">
            {error}
          </div>
        )}

        <section className="mt-4 rounded-[22px] border border-stone-200 bg-[#fffdf8] p-4 sm:mt-6 sm:rounded-[28px] sm:p-6 md:p-7">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#B65A65]">
              Your books
            </div>

            <h2 className="mt-1 text-xl font-semibold">
              Rated books
            </h2>
          </div>

          {loading ? (
            <p className="mt-5 text-sm text-stone-500">
              Loading your books...
            </p>
          ) : ratings.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-[#E6D8D4] bg-[#F6E8E6]/60 px-5 py-8 text-center">
              <p className="text-sm font-medium text-[#8F2635]">
                Books you rate will show up here.
              </p>
            </div>
          ) : (
            <div className="mt-5 grid gap-3">
              {ratings.map((rating) => (
                <a
                  key={rating.id}
                  href={
                    rating.books
                      ? bookHref(rating.books)
                      : "#"
                  }
                  className="flex items-center gap-4 rounded-2xl border border-stone-200 bg-white p-4 transition hover:border-[#E6D8D4] hover:bg-[#FFFDF9]"
                >
                  <div className="h-20 w-14 shrink-0 overflow-hidden rounded-lg bg-[#eee8dc]">
                    {rating.books?.cover_url ? (
                      <img
                        src={rating.books.cover_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center px-1 text-center text-[10px] font-medium text-stone-400">
                        No cover
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">
                      {rating.books?.title || "Book"}
                    </div>
                    <div className="mt-0.5 truncate text-sm text-stone-500">
                      {rating.books?.author || "Unknown author"}
                    </div>

                    {rating.content && (
                      <p className="mt-2 line-clamp-1 text-sm text-stone-600">
                        {rating.contains_spoilers
                          ? "Review contains spoilers"
                          : rating.content}
                      </p>
                    )}
                  </div>

                  <div className="shrink-0 rounded-xl bg-[#F6E8E6] px-3 py-2 text-sm font-bold text-[#8F2635]">
                    {Number(rating.overall_rating).toFixed(1)}
                  </div>
                </a>
              ))}
            </div>
          )}
        </section>

        <section className="mt-4 rounded-[22px] border border-stone-200 bg-[#fffdf8] p-4 sm:mt-6 sm:rounded-[28px] sm:p-6 md:p-7">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#B65A65]">
              Your activity
            </div>

            <h2 className="mt-1 text-xl font-semibold">
              Posts
            </h2>
          </div>

          {loading ? (
            <p className="mt-5 text-sm text-stone-500">
              Loading your posts...
            </p>
          ) : posts.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-[#E6D8D4] bg-[#F6E8E6]/60 px-5 py-8 text-center">
              <p className="text-sm font-medium text-[#8F2635]">
                Your posts will show up here.
              </p>
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {posts.map((post) => (
                <a
                  key={post.id}
                  href={
                    post.books ? bookHref(post.books) : "#"
                  }
                  className="block rounded-2xl border border-stone-200 bg-white p-5 transition hover:border-[#E6D8D4] hover:bg-[#FFFDF9]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-[#8F2635]">
                        {post.books?.title || "Book"}
                      </div>
                      <div className="mt-1 text-xs text-stone-400">
                        {formatDate(post.created_at)}
                      </div>
                    </div>

                    {post.contains_spoilers && (
                      <span className="shrink-0 rounded-full border border-[#E6D8D4] bg-[#F6E8E6]/80 px-2.5 py-1 text-[10px] font-bold text-[#8F2635]">
                        Spoilers
                      </span>
                    )}
                  </div>

                  <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-stone-600">
                    {post.contains_spoilers
                      ? "This post contains spoilers."
                      : post.content}
                  </p>
                </a>
              ))}
            </div>
          )}
        </section>

      </div>

      {topBooksOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-stone-900/30 px-4 py-6 backdrop-blur-[2px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeTopBooksEditor();
            }
          }}
        >
          <div className="w-full max-w-2xl rounded-[22px] border border-stone-200 bg-[#fffdf8] p-4 shadow-xl sm:rounded-[28px] sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#B65A65]">
                  Your taste
                </div>
                <h2 className="mt-1 text-2xl font-semibold">Choose your Top 4</h2>
                <p className="mt-1 text-sm leading-6 text-stone-500">
                  Pick the four books that feel the most like you. You can change them anytime.
                </p>
              </div>

              <button
                type="button"
                onClick={closeTopBooksEditor}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xl leading-none text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2 sm:mt-6 sm:grid-cols-4 sm:gap-3">
              {draftTopBooks.map((book, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => {
                    setActiveTopBookSlot(index);
                    setTopBooksError("");
                  }}
                  className={`relative overflow-hidden rounded-2xl border text-left transition ${
                    activeTopBookSlot === index
                      ? "border-[#8F2635] ring-2 ring-[#EBCFD0]"
                      : "border-stone-200 hover:border-[#D8B9BC]"
                  }`}
                >
                  <div className="aspect-[2/3] bg-[#eee8dc]">
                    {book?.cover_url ? (
                      <img
                        src={book.cover_url}
                        alt={book.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center px-3 text-center">
                        <div className="text-xs font-bold text-[#B65A65]">#{index + 1}</div>
                        <div className="mt-2 text-xs font-semibold text-stone-500">
                          {book ? book.title : "Choose a book"}
                        </div>
                      </div>
                    )}
                  </div>

                  {book && (
                    <div className="p-2.5">
                      <div className="truncate text-xs font-semibold">{book.title}</div>
                      <div className="mt-0.5 truncate text-[11px] text-stone-500">
                        {book.author || "Unknown author"}
                      </div>
                    </div>
                  )}

                  <div className="absolute left-2 top-2 rounded-full bg-[#fffdf8]/90 px-2 py-1 text-[10px] font-bold text-[#8F2635] shadow-sm">
                    #{index + 1}
                  </div>
                </button>
              ))}
            </div>

            {draftTopBooks[activeTopBookSlot] && (
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => removeDraftTopBook(activeTopBookSlot)}
                  className="text-xs font-semibold text-[#9a5d50] transition hover:text-[#7f493f]"
                >
                  Remove book from #{activeTopBookSlot + 1}
                </button>
              </div>
            )}

            <div className="mt-5 rounded-2xl border border-stone-200 bg-white p-4">
              <label htmlFor="top-book-search" className="text-sm font-semibold text-stone-700">
                Search for book #{activeTopBookSlot + 1}
              </label>
              <input
                id="top-book-search"
                value={topBookQuery}
                onChange={(event) => {
                  setTopBookQuery(event.target.value);
                  setTopBooksError("");
                }}
                placeholder="Search by title or author..."
                className="mt-2 w-full rounded-xl border border-stone-200 bg-[#fffdf8] px-4 py-3 text-sm outline-none transition focus:border-[#E6D8D4] focus:ring-2 focus:ring-[#EBCFD0]"
              />

              {topBookQuery.trim().length >= 2 && (
                <div className="mt-3 max-h-64 overflow-y-auto rounded-xl border border-stone-200 bg-[#fffdf8]">
                  {searchingTopBooks ? (
                    <div className="p-4 text-sm text-stone-500">Searching books...</div>
                  ) : topBookResults.length === 0 ? (
                    <div className="p-4 text-sm text-stone-500">
                      No books found yet. Try another title or author.
                    </div>
                  ) : (
                    topBookResults.slice(0, 8).map((book) => (
                      <button
                        key={book.id}
                        type="button"
                        onClick={() => chooseTopBook(book)}
                        className="flex w-full items-center gap-3 border-b border-stone-100 p-3 text-left transition last:border-b-0 hover:bg-[#f7f4ed]"
                      >
                        <div className="h-16 w-11 shrink-0 overflow-hidden rounded-md bg-[#eee8dc]">
                          {book.cover ? (
                            <img
                              src={book.cover}
                              alt={book.title}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center px-1 text-center text-[9px] text-stone-400">
                              No cover
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-stone-800">
                            {book.title}
                          </div>
                          <div className="mt-0.5 truncate text-xs text-stone-500">
                            {book.author || "Unknown author"}
                          </div>
                        </div>
                        <span className="shrink-0 text-xs font-semibold text-[#8F2635]">
                          Choose
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {topBooksError && (
              <div className="mt-4 rounded-xl border border-[#d6b5ad] bg-[#f8ebe7] px-4 py-3 text-sm text-[#8a4f43]">
                {topBooksError}
              </div>
            )}

            <div className="mt-6 flex items-center justify-between gap-3">
              <div className="text-xs text-stone-400">
                {draftTopBooks.filter(Boolean).length}/4 selected
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={closeTopBooksEditor}
                  disabled={savingTopBooks}
                  className="rounded-xl px-4 py-2.5 text-sm font-semibold text-stone-500 transition hover:bg-stone-100 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveTopBooks}
                  disabled={savingTopBooks}
                  className="rounded-xl bg-[#8F2635] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#7B1F2D] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingTopBooks ? "Saving..." : "Save Top 4"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/30 px-4 backdrop-blur-[2px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeEditProfile();
            }
          }}
        >
          <div className="w-full max-w-md rounded-[28px] border border-stone-200 bg-[#fffdf8] p-6 shadow-xl sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#B65A65]">
                  Profile
                </div>
                <h2 className="mt-1 text-2xl font-semibold">
                  Edit profile
                </h2>
              </div>

              <button
                type="button"
                onClick={closeEditProfile}
                className="flex h-9 w-9 items-center justify-center rounded-full text-xl leading-none text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="mt-6">
              <label
                htmlFor="profile-name"
                className="text-sm font-semibold text-stone-700"
              >
                Display name
              </label>
              <input
                id="profile-name"
                value={draftUsername}
                onChange={(event) =>
                  setDraftUsername(event.target.value)
                }
                maxLength={24}
                className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#E6D8D4] focus:ring-2 focus:ring-[#EBCFD0]"
                placeholder="Your display name"
              />
              <div className="mt-1 text-right text-[11px] text-stone-400">
                {draftUsername.length}/24
              </div>
            </div>

            <div className="mt-4">
              <label
                htmlFor="profile-bio"
                className="text-sm font-semibold text-stone-700"
              >
                Bio
              </label>
              <textarea
                id="profile-bio"
                value={draftBio}
                onChange={(event) =>
                  setDraftBio(event.target.value)
                }
                maxLength={160}
                rows={4}
                className="mt-2 w-full resize-none rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm leading-6 outline-none transition focus:border-[#E6D8D4] focus:ring-2 focus:ring-[#EBCFD0]"
                placeholder="A little about your reading taste..."
              />
              <div className="mt-1 text-right text-[11px] text-stone-400">
                {draftBio.length}/160
              </div>
            </div>

            {profileError && (
              <div className="mt-4 rounded-xl border border-[#d6b5ad] bg-[#f8ebe7] px-4 py-3 text-sm text-[#8a4f43]">
                {profileError}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeEditProfile}
                disabled={savingProfile}
                className="rounded-xl px-4 py-2.5 text-sm font-semibold text-stone-500 transition hover:bg-stone-100 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={saveProfile}
                disabled={savingProfile}
                className="rounded-xl bg-[#8F2635] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#7B1F2D] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingProfile ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
