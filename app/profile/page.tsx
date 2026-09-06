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

  const [bio, setBio] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [draftUsername, setDraftUsername] = useState("");
  const [draftBio, setDraftBio] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");

  useEffect(() => {
    const savedUserId =
      localStorage.getItem("nextchapter_guest_id") || "";
    const savedUsername =
      localStorage.getItem("nextchapter_guest_username") ||
      "Bookworm";
    const savedBio =
      localStorage.getItem("nextchapter_profile_bio") || "";

    setUserId(savedUserId);
    setUsername(savedUsername);
    setBio(savedBio);
    setDraftUsername(savedUsername);
    setDraftBio(savedBio);

    if (!savedUserId) {
      setLoading(false);
      return;
    }

    loadProfile(savedUserId);
  }, []);

  async function loadProfile(currentUserId: string) {
    setLoading(true);
    setError("");

    try {
      const [ratingsResult, postsResult] = await Promise.all([
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
      ]);

      if (ratingsResult.error) {
        throw ratingsResult.error;
      }

      if (postsResult.error) {
        throw postsResult.error;
      }

      setRatings((ratingsResult.data || []) as unknown as Rating[]);
      setPosts((postsResult.data || []) as unknown as DiscussionPost[]);
    } catch (profileError) {
      console.error("Profile load error:", profileError);
      setError("Could not load your profile activity right now.");
    } finally {
      setLoading(false);
    }
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
        const [ratingsUpdate, postsUpdate, commentsUpdate] =
          await Promise.all([
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
          ]);

        const updateError =
          ratingsUpdate.error ||
          postsUpdate.error ||
          commentsUpdate.error;

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

  return (
    <main className="min-h-screen bg-[#f7f2e8] text-stone-900">
      <SiteHeader active="profile" />

      <div className="mx-auto max-w-5xl px-5 py-8 md:py-12">
        <section className="rounded-[32px] border border-stone-200 bg-[#fffdf8] p-6 shadow-sm md:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#dfe7da] text-xl font-semibold text-[#4f5f45]">
                {username.slice(0, 1).toUpperCase()}
              </div>

              <div>
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#8a6f47]">
                  Reader profile
                </div>

                <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
                  {username}
                </h1>

                <p className="mt-1 max-w-xl text-sm leading-6 text-stone-500">
                  {bio || "Your reading life on NextChapter."}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={openEditProfile}
              className="self-start rounded-xl border border-[#cfd8ca] bg-[#eef2ea] px-4 py-2 text-sm font-semibold text-[#4f5f45] transition hover:bg-[#e3eadf]"
            >
              Edit profile
            </button>
          </div>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-stone-200 bg-white p-5">
            <div className="text-2xl font-semibold text-[#4f5f45]">
              {loading ? "—" : ratings.length}
            </div>
            <div className="mt-1 text-sm text-stone-500">
              Books rated
            </div>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-5">
            <div className="text-2xl font-semibold text-[#4f5f45]">
              {loading ? "—" : posts.length}
            </div>
            <div className="mt-1 text-sm text-stone-500">
              Discussions
            </div>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-5">
            <div className="text-2xl font-semibold text-[#4f5f45]">
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

        <section className="mt-6 rounded-[28px] border border-stone-200 bg-[#fffdf8] p-6 md:p-7">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#8a6f47]">
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
            <div className="mt-5 rounded-2xl border border-dashed border-[#cfd8ca] bg-[#eef2ea]/60 px-5 py-8 text-center">
              <p className="text-sm font-medium text-[#5c6755]">
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
                  className="flex items-center gap-4 rounded-2xl border border-stone-200 bg-white p-4 transition hover:border-[#c9d3c4] hover:bg-[#fafcf8]"
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

                  <div className="shrink-0 rounded-xl bg-[#eef2ea] px-3 py-2 text-sm font-bold text-[#4f5f45]">
                    {Number(rating.overall_rating).toFixed(1)}
                  </div>
                </a>
              ))}
            </div>
          )}
        </section>

        <section className="mt-6 rounded-[28px] border border-stone-200 bg-[#fffdf8] p-6 md:p-7">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#8a6f47]">
              Your activity
            </div>

            <h2 className="mt-1 text-xl font-semibold">
              Discussions
            </h2>
          </div>

          {loading ? (
            <p className="mt-5 text-sm text-stone-500">
              Loading your discussions...
            </p>
          ) : posts.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-[#cfd8ca] bg-[#eef2ea]/60 px-5 py-8 text-center">
              <p className="text-sm font-medium text-[#5c6755]">
                Your discussion posts will show up here.
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
                  className="block rounded-2xl border border-stone-200 bg-white p-5 transition hover:border-[#c9d3c4] hover:bg-[#fafcf8]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-[#4f5f45]">
                        {post.books?.title || "Book"}
                      </div>
                      <div className="mt-1 text-xs text-stone-400">
                        {formatDate(post.created_at)}
                      </div>
                    </div>

                    {post.contains_spoilers && (
                      <span className="shrink-0 rounded-full border border-[#bdc9b6] bg-[#e7eee2]/80 px-2.5 py-1 text-[10px] font-bold text-[#4f5f45]">
                        Spoilers
                      </span>
                    )}
                  </div>

                  <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-stone-600">
                    {post.contains_spoilers
                      ? "This discussion contains spoilers."
                      : post.content}
                  </p>
                </a>
              ))}
            </div>
          )}
        </section>

        {!userId && !loading && (
          <p className="mt-6 text-center text-xs text-stone-400">
            Your reader profile will start filling in after you rate or discuss a book.
          </p>
        )}
      </div>

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
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#8a6f47]">
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
                className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#aebaa5] focus:ring-2 focus:ring-[#dfe7da]"
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
                className="mt-2 w-full resize-none rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm leading-6 outline-none transition focus:border-[#aebaa5] focus:ring-2 focus:ring-[#dfe7da]"
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
                className="rounded-xl bg-[#4f5f45] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#43513b] disabled:cursor-not-allowed disabled:opacity-60"
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
