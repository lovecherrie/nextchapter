"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type Book = {
  id: string;
  external_id: string | null;
  title: string;
  author: string | null;
  cover_url: string | null;
};

type SearchBook = {
  external_id: string;
  title: string;
  author: string;
  cover_url: string | null;
};

type Like = {
  id: string;
  user_id: string;
};

type Comment = {
  id: string;
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
  discussion_likes: Like[];
  comments: Comment[];
};

type Filter = "top" | "newest" | "spoiler-free";

function getGuestUser() {
  if (typeof window === "undefined") {
    return {
      id: "",
      username: "Bookworm",
    };
  }

  let id = localStorage.getItem("nextchapter_guest_id");
  let username = localStorage.getItem("nextchapter_guest_username");

  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("nextchapter_guest_id", id);
  }

  if (!username) {
    username = `Bookworm${Math.floor(1000 + Math.random() * 9000)}`;
    localStorage.setItem("nextchapter_guest_username", username);
  }

  return {
    id,
    username,
  };
}

function timeAgo(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();

  const seconds = Math.floor(
    (now.getTime() - date.getTime()) / 1000
  );

  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);

  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);

  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function makeBookUrl(book: Book) {
  const params = new URLSearchParams();

  params.set(
    "book",
    book.external_id ||
      book.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
  );

  params.set("title", book.title);

  if (book.author) {
    params.set("author", book.author);
  }

  if (book.cover_url) {
    params.set("cover", book.cover_url);
  }

  return `/book?${params.toString()}`;
}

function normalizeSearchResults(data: any): SearchBook[] {
  const rawBooks = Array.isArray(data)
    ? data
    : Array.isArray(data?.books)
    ? data.books
    : Array.isArray(data?.results)
    ? data.results
    : [];

  return rawBooks
    .map((book: any) => {
      const title =
        book?.title ||
        book?.volumeInfo?.title ||
        "";

      const authors =
        book?.authors ||
        book?.volumeInfo?.authors ||
        [];

      const author =
        book?.author ||
        (Array.isArray(authors) ? authors.join(", ") : authors) ||
        "Unknown author";

      const externalId =
        book?.external_id ||
        book?.externalId ||
        book?.id ||
        book?.googleBooksId ||
        `${title}-${author}`
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");

      const cover =
        book?.cover_url ||
        book?.cover ||
        book?.thumbnail ||
        book?.imageLinks?.thumbnail ||
        book?.volumeInfo?.imageLinks?.thumbnail ||
        null;

      return {
        external_id: String(externalId),
        title: String(title),
        author: String(author),
        cover_url: cover ? String(cover).replace("http://", "https://") : null,
      };
    })
    .filter((book: SearchBook) => book.title);
}

export default function CommunityPage() {
  const [posts, setPosts] = useState<DiscussionPost[]>([]);
  const [filter, setFilter] = useState<Filter>("top");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [guestUserId, setGuestUserId] = useState("");
  const [guestUsername, setGuestUsername] = useState("");

  const [revealedSpoilers, setRevealedSpoilers] = useState<string[]>([]);
  const [likingPost, setLikingPost] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);

  const [bookQuery, setBookQuery] = useState("");
  const [bookResults, setBookResults] = useState<SearchBook[]>([]);
  const [selectedBook, setSelectedBook] = useState<SearchBook | null>(null);

  const [searchingBooks, setSearchingBooks] = useState(false);
  const [discussionText, setDiscussionText] = useState("");
  const [containsSpoilers, setContainsSpoilers] = useState(false);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState("");

  useEffect(() => {
    const guest = getGuestUser();

    setGuestUserId(guest.id);
    setGuestUsername(guest.username);

    loadPosts();
  }, []);

  useEffect(() => {
    if (selectedBook) return;

    const trimmed = bookQuery.trim();

    if (trimmed.length < 2) {
      setBookResults([]);
      return;
    }

    const timeout = setTimeout(() => {
      searchBooks(trimmed);
    }, 350);

    return () => clearTimeout(timeout);
  }, [bookQuery, selectedBook]);

  async function loadPosts() {
    setLoading(true);
    setError("");

    const { data, error } = await supabase
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
        ),
        discussion_likes (
          id,
          user_id
        ),
        comments (
          id
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setError("Could not load the community right now.");
      setLoading(false);
      return;
    }

    setPosts((data || []) as unknown as DiscussionPost[]);
    setLoading(false);
  }

  async function searchBooks(query: string) {
    setSearchingBooks(true);

    try {
      const response = await fetch(
        `/api/books/search?q=${encodeURIComponent(query)}`
      );

      if (!response.ok) {
        throw new Error("Book search failed");
      }

      const data = await response.json();
      setBookResults(normalizeSearchResults(data));
    } catch (error) {
      console.error(error);
      setBookResults([]);
    } finally {
      setSearchingBooks(false);
    }
  }

  async function findOrCreateBook(searchBook: SearchBook) {
    const { data: existingBook, error: existingError } =
      await supabase
        .from("books")
        .select("id, external_id, title, author, cover_url")
        .eq("external_id", searchBook.external_id)
        .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (existingBook) {
      return existingBook as Book;
    }

    const { data: insertedBook, error: insertError } =
      await supabase
        .from("books")
        .insert({
          external_id: searchBook.external_id,
          title: searchBook.title,
          author: searchBook.author,
          cover_url: searchBook.cover_url,
        })
        .select("id, external_id, title, author, cover_url")
        .single();

    if (!insertError && insertedBook) {
      return insertedBook as Book;
    }

    if ((insertError as any)?.code === "23505") {
      const { data: duplicateBook, error: duplicateError } =
        await supabase
          .from("books")
          .select("id, external_id, title, author, cover_url")
          .eq("external_id", searchBook.external_id)
          .single();

      if (duplicateError) {
        throw duplicateError;
      }

      return duplicateBook as Book;
    }

    throw insertError;
  }

  async function createPost() {
    setPostError("");

    if (!selectedBook) {
      setPostError("Choose a book first.");
      return;
    }

    if (!discussionText.trim()) {
      setPostError("Write something before posting.");
      return;
    }

    if (!guestUserId || !guestUsername) {
      setPostError("Guest profile is still loading. Try again.");
      return;
    }

    setPosting(true);

    try {
      const book = await findOrCreateBook(selectedBook);

      const { data: newPost, error: insertError } =
        await supabase
          .from("discussion_posts")
          .insert({
            book_id: book.id,
            user_id: guestUserId,
            username: guestUsername,
            content: discussionText.trim(),
            contains_spoilers: containsSpoilers,
          })
          .select(`
            id,
            book_id,
            user_id,
            username,
            content,
            contains_spoilers,
            created_at
          `)
          .single();

      if (insertError) {
        throw insertError;
      }

      const completePost: DiscussionPost = {
        ...newPost,
        books: book,
        discussion_likes: [],
        comments: [],
      };

      setPosts((current) => [completePost, ...current]);

      setDiscussionText("");
      setContainsSpoilers(false);
      setBookQuery("");
      setBookResults([]);
      setSelectedBook(null);
      setCreateOpen(false);
      setFilter("newest");
    } catch (error) {
      console.error(error);
      setPostError("Could not publish your post. Please try again.");
    } finally {
      setPosting(false);
    }
  }

  function closeCreateModal() {
    if (posting) return;

    setCreateOpen(false);
    setBookQuery("");
    setBookResults([]);
    setSelectedBook(null);
    setDiscussionText("");
    setContainsSpoilers(false);
    setPostError("");
  }

  async function toggleLike(post: DiscussionPost) {
    if (!guestUserId || likingPost) return;

    setLikingPost(post.id);

    const existingLike = post.discussion_likes.find(
      (like) => like.user_id === guestUserId
    );

    if (existingLike) {
      const { error } = await supabase
        .from("discussion_likes")
        .delete()
        .eq("id", existingLike.id);

      if (!error) {
        setPosts((currentPosts) =>
          currentPosts.map((currentPost) =>
            currentPost.id === post.id
              ? {
                  ...currentPost,
                  discussion_likes:
                    currentPost.discussion_likes.filter(
                      (like) => like.id !== existingLike.id
                    ),
                }
              : currentPost
          )
        );
      }
    } else {
      const { data, error } = await supabase
        .from("discussion_likes")
        .insert({
          post_id: post.id,
          user_id: guestUserId,
        })
        .select("id, user_id")
        .single();

      if (!error && data) {
        setPosts((currentPosts) =>
          currentPosts.map((currentPost) =>
            currentPost.id === post.id
              ? {
                  ...currentPost,
                  discussion_likes: [
                    ...currentPost.discussion_likes,
                    data as Like,
                  ],
                }
              : currentPost
          )
        );
      }
    }

    setLikingPost(null);
  }

  function toggleSpoiler(postId: string) {
    setRevealedSpoilers((current) =>
      current.includes(postId)
        ? current.filter((id) => id !== postId)
        : [...current, postId]
    );
  }

  const filteredPosts = useMemo(() => {
    let result = [...posts];

    if (filter === "spoiler-free") {
      result = result.filter((post) => !post.contains_spoilers);
    }

    if (filter === "top") {
      result.sort((a, b) => {
        const scoreA =
          a.discussion_likes.length + a.comments.length * 2;

        const scoreB =
          b.discussion_likes.length + b.comments.length * 2;

        if (scoreB === scoreA) {
          return (
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime()
          );
        }

        return scoreB - scoreA;
      });
    }

    if (filter === "newest") {
      result.sort(
        (a, b) =>
          new Date(b.created_at).getTime() -
          new Date(a.created_at).getTime()
      );
    }

    return result;
  }, [posts, filter]);

  return (
    <main className="min-h-screen bg-[#f7f2e8] text-[#283322]">
      <header className="sticky top-0 z-40 border-b border-[#ddd5c4] bg-[#f7f2e8]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <a
            href="/"
            className="flex items-center gap-2 text-xl font-bold tracking-tight text-[#415038]"
          >
            <span className="text-2xl">🐛</span>
            NextChapter
          </a>

          <nav className="flex items-center gap-2 text-sm font-semibold">
            <a
              href="/"
              className="rounded-full px-4 py-2 text-[#59684f] transition hover:bg-[#ebe5d8]"
            >
              Find Books
            </a>

            <a
              href="/community"
              className="rounded-full bg-[#4f5f45] px-4 py-2 text-white"
            >
              Community
            </a>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-10">
        <div className="mb-9 grid gap-6 lg:grid-cols-[1fr_300px]">
          <div className="rounded-[32px] border border-[#ded5c4] bg-[#fffdf8] p-7 shadow-sm sm:p-9">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#edf0e8] px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[#53614c]">
              ☕ The reading room
            </div>

            <h1 className="max-w-2xl text-4xl font-bold leading-tight text-[#35412f] sm:text-5xl">
              Talk about the books you can&apos;t stop thinking about.
            </h1>

            <p className="mt-4 max-w-2xl text-base leading-7 text-[#6c7465]">
              Share theories, unpopular opinions, reactions, and bookish
              thoughts with other readers.
            </p>
          </div>

          <div className="rounded-[32px] border border-[#ded5c4] bg-[#4f5f45] p-7 text-[#fffdf8] shadow-sm">
            <div className="text-3xl">📚</div>

            <h2 className="mt-5 text-xl font-bold">
              Got something to say?
            </h2>

            <p className="mt-2 text-sm leading-6 text-[#e5eadf]">
              Choose a book and start a conversation with other readers.
            </p>

            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="mt-5 inline-flex rounded-full bg-[#fffdf8] px-5 py-2.5 text-sm font-bold text-[#4f5f45] transition hover:scale-[1.02]"
            >
              + Create post
            </button>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-[#35412f]">
              Community discussions
            </h2>

            <p className="mt-1 text-sm text-[#7b8175]">
              Jump into conversations from across NextChapter.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="rounded-full bg-[#4f5f45] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#43513b]"
            >
              + Create post
            </button>

            <div className="flex rounded-full border border-[#d8d0c0] bg-[#fffdf8] p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setFilter("top")}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  filter === "top"
                    ? "bg-[#4f5f45] text-white"
                    : "text-[#677060] hover:bg-[#f0ece2]"
                }`}
              >
                🔥 Top
              </button>

              <button
                type="button"
                onClick={() => setFilter("newest")}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  filter === "newest"
                    ? "bg-[#4f5f45] text-white"
                    : "text-[#677060] hover:bg-[#f0ece2]"
                }`}
              >
                ✨ Newest
              </button>

              <button
                type="button"
                onClick={() => setFilter("spoiler-free")}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  filter === "spoiler-free"
                    ? "bg-[#4f5f45] text-white"
                    : "text-[#677060] hover:bg-[#f0ece2]"
                }`}
              >
                🌿 Spoiler-free
              </button>
            </div>
          </div>
        </div>

        {loading && (
          <div className="rounded-[28px] border border-[#ded5c4] bg-[#fffdf8] px-6 py-16 text-center shadow-sm">
            <div className="text-4xl">📖</div>

            <p className="mt-4 font-semibold text-[#53614c]">
              Opening the reading room...
            </p>
          </div>
        )}

        {!loading && error && (
          <div className="rounded-[28px] border border-[#e1c7bd] bg-[#fff8f5] px-6 py-12 text-center">
            <p className="font-semibold text-[#8b5548]">{error}</p>

            <button
              type="button"
              onClick={loadPosts}
              className="mt-4 rounded-full bg-[#4f5f45] px-5 py-2.5 text-sm font-bold text-white"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && filteredPosts.length === 0 && (
          <div className="rounded-[28px] border border-dashed border-[#d3cab9] bg-[#fffdf8] px-6 py-16 text-center">
            <div className="text-5xl">🪱</div>

            <h3 className="mt-5 text-xl font-bold text-[#44503d]">
              It&apos;s a little quiet in here.
            </h3>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#767d70]">
              Be the first reader to start a conversation.
            </p>

            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="mt-5 inline-flex rounded-full bg-[#4f5f45] px-5 py-2.5 text-sm font-bold text-white"
            >
              + Create the first post
            </button>
          </div>
        )}

        {!loading && !error && filteredPosts.length > 0 && (
          <div className="space-y-4">
            {filteredPosts.map((post) => {
              const book = post.books;

              const likedByMe = post.discussion_likes.some(
                (like) => like.user_id === guestUserId
              );

              const spoilerRevealed =
                revealedSpoilers.includes(post.id);

              return (
                <article
                  key={post.id}
                  className="overflow-hidden rounded-[28px] border border-[#ded5c4] bg-[#fffdf8] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  {book && (
                    <div className="border-b border-[#eee8dc] bg-[#fbf8f1] px-5 py-4 sm:px-6">
                      <a
                        href={makeBookUrl(book)}
                        className="group flex items-center gap-3"
                      >
                        {book.cover_url ? (
                          <img
                            src={book.cover_url}
                            alt={book.title}
                            className="h-16 w-11 rounded-md object-cover shadow-sm"
                          />
                        ) : (
                          <div className="flex h-16 w-11 items-center justify-center rounded-md bg-[#e5dfd1] text-xl">
                            📕
                          </div>
                        )}

                        <div className="min-w-0">
                          <div className="text-xs font-bold uppercase tracking-[0.12em] text-[#9b8b6c]">
                            Discussing
                          </div>

                          <h3 className="truncate font-bold text-[#3f4b38] group-hover:underline">
                            {book.title}
                          </h3>

                          {book.author && (
                            <p className="truncate text-sm text-[#7c8275]">
                              {book.author}
                            </p>
                          )}
                        </div>
                      </a>
                    </div>
                  )}

                  <div className="p-5 sm:p-6">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e4e9df] text-lg">
                          🐛
                        </div>

                        <div>
                          <div className="font-bold text-[#495541]">
                            {post.username}
                          </div>

                          <div className="text-xs text-[#92978c]">
                            {timeAgo(post.created_at)}
                          </div>
                        </div>
                      </div>

                      {post.contains_spoilers && (
                        <span className="rounded-full bg-[#f1e7d8] px-3 py-1.5 text-xs font-bold text-[#8a6f47]">
                          ⚠️ Spoilers
                        </span>
                      )}
                    </div>

                    {post.contains_spoilers && !spoilerRevealed ? (
                      <button
                        type="button"
                        onClick={() => toggleSpoiler(post.id)}
                        className="w-full rounded-2xl border border-dashed border-[#cfc3ae] bg-[#f7f1e6] px-5 py-8 text-center"
                      >
                        <div className="text-2xl">🙈</div>

                        <div className="mt-2 font-bold text-[#665b48]">
                          This post contains spoilers
                        </div>

                        <div className="mt-1 text-sm text-[#8b806d]">
                          Click to reveal
                        </div>
                      </button>
                    ) : (
                      <div>
                        <p className="whitespace-pre-wrap text-[15px] leading-7 text-[#495046]">
                          {post.content}
                        </p>

                        {post.contains_spoilers && (
                          <button
                            type="button"
                            onClick={() => toggleSpoiler(post.id)}
                            className="mt-3 text-xs font-bold text-[#8a6f47] hover:underline"
                          >
                            Hide spoiler
                          </button>
                        )}
                      </div>
                    )}

                    <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-[#eee8dc] pt-4">
                      <button
                        type="button"
                        disabled={likingPost === post.id}
                        onClick={() => toggleLike(post)}
                        className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                          likedByMe
                            ? "bg-[#e5eadf] text-[#43503b]"
                            : "bg-[#f4f0e7] text-[#72786d] hover:bg-[#ebe5d9]"
                        }`}
                      >
                        {likedByMe ? "♥" : "♡"}{" "}
                        {post.discussion_likes.length}
                      </button>

                      {book ? (
                        <a
                          href={makeBookUrl(book)}
                          className="rounded-full bg-[#f4f0e7] px-4 py-2 text-sm font-bold text-[#72786d] transition hover:bg-[#ebe5d9]"
                        >
                          💬 {post.comments.length}{" "}
                          {post.comments.length === 1
                            ? "comment"
                            : "comments"}
                        </a>
                      ) : (
                        <span className="rounded-full bg-[#f4f0e7] px-4 py-2 text-sm font-bold text-[#72786d]">
                          💬 {post.comments.length}
                        </span>
                      )}

                      {book && (
                        <a
                          href={makeBookUrl(book)}
                          className="ml-auto text-sm font-bold text-[#56634f] hover:underline"
                        >
                          Join discussion →
                        </a>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <div className="mt-8 rounded-[28px] border border-[#ded5c4] bg-[#fffdf8] px-6 py-5 text-center text-sm text-[#7a8174]">
          You&apos;re currently posting as{" "}
          <span className="font-bold text-[#55614e]">
            {guestUsername || "a temporary guest bookworm"}
          </span>
          . Profiles are coming later. 🐛
        </div>
      </section>

      {createOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#2c3328]/45 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeCreateModal();
            }
          }}
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[30px] border border-[#d9d0bf] bg-[#fffdf8] shadow-2xl">
            <div className="flex items-start justify-between border-b border-[#eee7da] px-6 py-5 sm:px-7">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.14em] text-[#8a7b60]">
                  New discussion
                </div>

                <h2 className="mt-1 text-2xl font-bold text-[#394534]">
                  What&apos;s on your mind?
                </h2>
              </div>

              <button
                type="button"
                onClick={closeCreateModal}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f1ede4] text-xl text-[#687061] transition hover:bg-[#e8e2d7]"
              >
                ×
              </button>
            </div>

            <div className="space-y-6 p-6 sm:p-7">
              <div>
                <label className="mb-2 block text-sm font-bold text-[#4b5744]">
                  Which book are you talking about?
                </label>

                {selectedBook ? (
                  <div className="flex items-center gap-4 rounded-2xl border border-[#ccd3c5] bg-[#f2f5ee] p-4">
                    {selectedBook.cover_url ? (
                      <img
                        src={selectedBook.cover_url}
                        alt={selectedBook.title}
                        className="h-20 w-14 rounded-lg object-cover shadow-sm"
                      />
                    ) : (
                      <div className="flex h-20 w-14 items-center justify-center rounded-lg bg-[#ddd8cb] text-2xl">
                        📕
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-[#3e4b38]">
                        {selectedBook.title}
                      </div>

                      <div className="mt-1 text-sm text-[#778071]">
                        {selectedBook.author}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedBook(null);
                        setBookQuery("");
                        setBookResults([]);
                      }}
                      className="rounded-full bg-white px-3 py-2 text-xs font-bold text-[#626c5c] shadow-sm"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      value={bookQuery}
                      onChange={(event) =>
                        setBookQuery(event.target.value)
                      }
                      placeholder="Search for a book..."
                      className="w-full rounded-2xl border border-[#d5cdbd] bg-white px-4 py-3.5 text-[#35412f] outline-none transition placeholder:text-[#a5aa9e] focus:border-[#829078]"
                    />

                    {bookQuery.trim().length >= 2 && (
                      <div className="mt-2 overflow-hidden rounded-2xl border border-[#ddd5c6] bg-white shadow-lg">
                        {searchingBooks && (
                          <div className="px-4 py-4 text-sm text-[#7b8275]">
                            Searching books...
                          </div>
                        )}

                        {!searchingBooks &&
                          bookResults.length === 0 && (
                            <div className="px-4 py-4 text-sm text-[#7b8275]">
                              No books found yet.
                            </div>
                          )}

                        {!searchingBooks &&
                          bookResults.slice(0, 6).map((book) => (
                            <button
                              type="button"
                              key={`${book.external_id}-${book.title}`}
                              onClick={() => {
                                setSelectedBook(book);
                                setBookResults([]);
                                setBookQuery(book.title);
                              }}
                              className="flex w-full items-center gap-3 border-b border-[#f0ece4] px-4 py-3 text-left transition last:border-b-0 hover:bg-[#f7f4ed]"
                            >
                              {book.cover_url ? (
                                <img
                                  src={book.cover_url}
                                  alt={book.title}
                                  className="h-14 w-10 rounded object-cover"
                                />
                              ) : (
                                <div className="flex h-14 w-10 items-center justify-center rounded bg-[#ece7dc]">
                                  📘
                                </div>
                              )}

                              <div className="min-w-0">
                                <div className="truncate font-bold text-[#45513f]">
                                  {book.title}
                                </div>

                                <div className="truncate text-sm text-[#7c8275]">
                                  {book.author}
                                </div>
                              </div>
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label className="text-sm font-bold text-[#4b5744]">
                    Start the discussion
                  </label>

                  <span className="text-xs text-[#999f93]">
                    {discussionText.length}/1000
                  </span>
                </div>

                <textarea
                  value={discussionText}
                  onChange={(event) =>
                    setDiscussionText(
                      event.target.value.slice(0, 1000)
                    )
                  }
                  rows={7}
                  placeholder="Share a theory, reaction, question, unpopular opinion..."
                  className="w-full resize-none rounded-2xl border border-[#d5cdbd] bg-white px-4 py-3.5 leading-7 text-[#35412f] outline-none transition placeholder:text-[#a5aa9e] focus:border-[#829078]"
                />
              </div>

              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-[#e0d8c9] bg-[#faf7f0] p-4">
                <input
                  type="checkbox"
                  checked={containsSpoilers}
                  onChange={(event) =>
                    setContainsSpoilers(event.target.checked)
                  }
                  className="h-4 w-4 accent-[#4f5f45]"
                />

                <div>
                  <div className="text-sm font-bold text-[#515d4a]">
                    ⚠️ This post contains spoilers
                  </div>

                  <div className="mt-0.5 text-xs text-[#858b80]">
                    Readers will have to reveal the post before seeing it.
                  </div>
                </div>
              </label>

              {postError && (
                <div className="rounded-2xl bg-[#fff0eb] px-4 py-3 text-sm font-semibold text-[#955b4c]">
                  {postError}
                </div>
              )}

              <div className="flex items-center justify-between gap-4 border-t border-[#eee7da] pt-5">
                <div className="text-xs text-[#969c90]">
                  Posting as{" "}
                  <span className="font-bold text-[#697362]">
                    {guestUsername || "Bookworm"}
                  </span>
                </div>

                <button
                  type="button"
                  disabled={posting}
                  onClick={createPost}
                  className="rounded-full bg-[#4f5f45] px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#43513b] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {posting ? "Posting..." : "Post discussion"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}