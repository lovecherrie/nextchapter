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
  post_id: string;
  user_id: string;
  username: string;
  content: string;
  contains_spoilers: boolean;
  parent_comment_id: string | null;
  created_at: string;
  updated_at: string;
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

function wasEdited(comment: Comment) {
  const created = new Date(comment.created_at).getTime();
  const updated = new Date(comment.updated_at).getTime();

  return updated - created > 2000;
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
        (Array.isArray(authors)
          ? authors.join(", ")
          : authors) ||
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
        cover_url: cover
          ? String(cover).replace("http://", "https://")
          : null,
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
  const [revealedCommentSpoilers, setRevealedCommentSpoilers] =
    useState<string[]>([]);

  const [likingPost, setLikingPost] = useState<string | null>(null);

  const [expandedPosts, setExpandedPosts] = useState<string[]>([]);

  const [commentDrafts, setCommentDrafts] = useState<
    Record<string, string>
  >({});

  const [commentSpoilers, setCommentSpoilers] = useState<
    Record<string, boolean>
  >({});

  const [postingComment, setPostingComment] =
    useState<string | null>(null);

  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replySpoiler, setReplySpoiler] = useState(false);

  const [editingCommentId, setEditingCommentId] =
    useState<string | null>(null);
  const [editingText, setEditingText] = useState("");

  const [commentMenu, setCommentMenu] =
    useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);

  const [bookQuery, setBookQuery] = useState("");
  const [bookResults, setBookResults] = useState<SearchBook[]>([]);
  const [selectedBook, setSelectedBook] =
    useState<SearchBook | null>(null);

  const [searchingBooks, setSearchingBooks] = useState(false);
  const [discussionText, setDiscussionText] = useState("");
  const [containsSpoilers, setContainsSpoilers] =
    useState(false);

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
          id,
          post_id,
          user_id,
          username,
          content,
          contains_spoilers,
          parent_comment_id,
          created_at,
          updated_at
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setError("Could not load the community right now.");
      setLoading(false);
      return;
    }

    const cleaned = (data || []).map((post: any) => ({
      ...post,
      comments: [...(post.comments || [])].sort(
        (a: Comment, b: Comment) =>
          new Date(a.created_at).getTime() -
          new Date(b.created_at).getTime()
      ),
    }));

    setPosts(cleaned as DiscussionPost[]);
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
      setPostError("Guest profile is still loading.");
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
      setPostError("Could not publish your post.");
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

  function toggleComments(postId: string) {
    setExpandedPosts((current) =>
      current.includes(postId)
        ? current.filter((id) => id !== postId)
        : [...current, postId]
    );
  }

  async function addComment(postId: string) {
    const content = commentDrafts[postId]?.trim();

    if (!content) return;

    setPostingComment(postId);

    const { data, error } = await supabase
      .from("comments")
      .insert({
        post_id: postId,
        user_id: guestUserId,
        username: guestUsername,
        content,
        contains_spoilers: commentSpoilers[postId] || false,
        parent_comment_id: null,
      })
      .select(`
        id,
        post_id,
        user_id,
        username,
        content,
        contains_spoilers,
        parent_comment_id,
        created_at,
        updated_at
      `)
      .single();

    if (!error && data) {
      setPosts((current) =>
        current.map((post) =>
          post.id === postId
            ? {
                ...post,
                comments: [...post.comments, data as Comment],
              }
            : post
        )
      );

      setCommentDrafts((current) => ({
        ...current,
        [postId]: "",
      }));

      setCommentSpoilers((current) => ({
        ...current,
        [postId]: false,
      }));
    }

    setPostingComment(null);
  }

  async function addReply(postId: string, parentCommentId: string) {
    const content = replyText.trim();

    if (!content) return;

    setPostingComment(parentCommentId);

    const { data, error } = await supabase
      .from("comments")
      .insert({
        post_id: postId,
        user_id: guestUserId,
        username: guestUsername,
        content,
        contains_spoilers: replySpoiler,
        parent_comment_id: parentCommentId,
      })
      .select(`
        id,
        post_id,
        user_id,
        username,
        content,
        contains_spoilers,
        parent_comment_id,
        created_at,
        updated_at
      `)
      .single();

    if (!error && data) {
      setPosts((current) =>
        current.map((post) =>
          post.id === postId
            ? {
                ...post,
                comments: [...post.comments, data as Comment],
              }
            : post
        )
      );

      setReplyText("");
      setReplySpoiler(false);
      setReplyingTo(null);
    }

    setPostingComment(null);
  }

  async function saveEditedComment(comment: Comment) {
    const content = editingText.trim();

    if (!content) return;

    const now = new Date().toISOString();

    const { error } = await supabase
      .from("comments")
      .update({
        content,
        updated_at: now,
      })
      .eq("id", comment.id);

    if (!error) {
      setPosts((current) =>
        current.map((post) => ({
          ...post,
          comments: post.comments.map((item) =>
            item.id === comment.id
              ? {
                  ...item,
                  content,
                  updated_at: now,
                }
              : item
          ),
        }))
      );

      setEditingCommentId(null);
      setEditingText("");
    }
  }

  async function deleteComment(comment: Comment) {
    const okay = window.confirm(
      "Delete this comment?"
    );

    if (!okay) return;

    const { error } = await supabase
      .from("comments")
      .delete()
      .eq("id", comment.id);

    if (!error) {
      setPosts((current) =>
        current.map((post) => ({
          ...post,
          comments: post.comments.filter(
            (item) =>
              item.id !== comment.id &&
              item.parent_comment_id !== comment.id
          ),
        }))
      );

      setCommentMenu(null);
    }
  }

  function toggleSpoiler(postId: string) {
    setRevealedSpoilers((current) =>
      current.includes(postId)
        ? current.filter((id) => id !== postId)
        : [...current, postId]
    );
  }

  function toggleCommentSpoiler(commentId: string) {
    setRevealedCommentSpoilers((current) =>
      current.includes(commentId)
        ? current.filter((id) => id !== commentId)
        : [...current, commentId]
    );
  }

  const filteredPosts = useMemo(() => {
    let result = [...posts];

    if (filter === "spoiler-free") {
      result = result.filter(
        (post) => !post.contains_spoilers
      );
    }

    if (filter === "top") {
      result.sort((a, b) => {
        const scoreA =
          a.discussion_likes.length +
          a.comments.length * 2;

        const scoreB =
          b.discussion_likes.length +
          b.comments.length * 2;

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

  function renderComment(
    comment: Comment,
    post: DiscussionPost,
    isReply = false
  ) {
    const mine = comment.user_id === guestUserId;

    const revealed =
      revealedCommentSpoilers.includes(comment.id);

    return (
      <div
        key={comment.id}
        className={`relative rounded-2xl ${
          isReply
            ? "ml-8 bg-[#f5f1e8] p-4"
            : "bg-[#f8f5ee] p-4 sm:p-5"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-[#46523f]">
                {comment.username}
              </span>

              <span className="text-xs text-[#969b91]">
                {timeAgo(comment.created_at)}
              </span>

              {wasEdited(comment) && (
                <span className="text-xs text-[#a09b90]">
                  edited
                </span>
              )}

              {comment.contains_spoilers && (
                <span className="rounded-full bg-[#eee3d2] px-2 py-1 text-[10px] font-bold text-[#8a6f47]">
                  SPOILER
                </span>
              )}
            </div>
          </div>

          {mine && (
            <div className="relative">
              <button
                type="button"
                onClick={() =>
                  setCommentMenu(
                    commentMenu === comment.id
                      ? null
                      : comment.id
                  )
                }
                className="rounded-full px-2 py-1 text-lg text-[#8b9087] hover:bg-[#ebe7de]"
              >
                •••
              </button>

              {commentMenu === comment.id && (
                <div className="absolute right-0 top-8 z-20 w-28 overflow-hidden rounded-xl border border-[#ded7ca] bg-white shadow-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCommentId(comment.id);
                      setEditingText(comment.content);
                      setCommentMenu(null);
                    }}
                    className="block w-full px-4 py-2.5 text-left text-sm font-semibold text-[#56614f] hover:bg-[#f6f3ec]"
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() => deleteComment(comment)}
                    className="block w-full px-4 py-2.5 text-left text-sm font-semibold text-[#9a5548] hover:bg-[#fff3ef]"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {editingCommentId === comment.id ? (
          <div className="mt-3">
            <textarea
              value={editingText}
              onChange={(event) =>
                setEditingText(event.target.value)
              }
              rows={3}
              className="w-full resize-none rounded-xl border border-[#d8d0c3] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#829078]"
            />

            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() =>
                  saveEditedComment(comment)
                }
                className="rounded-full bg-[#4f5f45] px-4 py-2 text-xs font-bold text-white"
              >
                Save
              </button>

              <button
                type="button"
                onClick={() => {
                  setEditingCommentId(null);
                  setEditingText("");
                }}
                className="rounded-full bg-[#ece8df] px-4 py-2 text-xs font-bold text-[#6b7365]"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : comment.contains_spoilers && !revealed ? (
          <button
            type="button"
            onClick={() =>
              toggleCommentSpoiler(comment.id)
            }
            className="mt-3 rounded-xl border border-dashed border-[#d2c6b3] bg-[#f3ede2] px-4 py-3 text-sm font-semibold text-[#776a56]"
          >
            🙈 Spoiler comment — tap to reveal
          </button>
        ) : (
          <p className="mt-3 whitespace-pre-wrap text-[15px] leading-6 text-[#4c5349]">
            {comment.content}
          </p>
        )}

        {!isReply && (
          <button
            type="button"
            onClick={() => {
              setReplyingTo(
                replyingTo === comment.id
                  ? null
                  : comment.id
              );
              setReplyText("");
              setReplySpoiler(false);
            }}
            className="mt-3 text-xs font-bold text-[#70796a] hover:underline"
          >
            Reply
          </button>
        )}

        {replyingTo === comment.id && !isReply && (
          <div className="mt-4 rounded-xl border border-[#ded7ca] bg-white p-3">
            <textarea
              value={replyText}
              onChange={(event) =>
                setReplyText(event.target.value)
              }
              placeholder={`Reply to ${comment.username}...`}
              rows={2}
              className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-[#a6aa9f]"
            />

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-xs text-[#7f857a]">
                <input
                  type="checkbox"
                  checked={replySpoiler}
                  onChange={(event) =>
                    setReplySpoiler(event.target.checked)
                  }
                  className="accent-[#4f5f45]"
                />
                Spoiler
              </label>

              <button
                type="button"
                onClick={() =>
                  addReply(post.id, comment.id)
                }
                disabled={
                  !replyText.trim() ||
                  postingComment === comment.id
                }
                className="rounded-full bg-[#4f5f45] px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
              >
                {postingComment === comment.id
                  ? "Replying..."
                  : "Reply"}
              </button>
            </div>
          </div>
        )}

        {!isReply &&
          post.comments
            .filter(
              (reply) =>
                reply.parent_comment_id === comment.id
            )
            .map((reply) => (
              <div key={reply.id} className="mt-3">
                {renderComment(reply, post, true)}
              </div>
            ))}
      </div>
    );
  }

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
              Talk about the books you can&apos;t stop
              thinking about.
            </h1>

            <p className="mt-4 max-w-2xl text-base leading-7 text-[#6c7465]">
              Share theories, unpopular opinions, reactions,
              and bookish thoughts with other readers.
            </p>
          </div>

          <div className="rounded-[32px] border border-[#ded5c4] bg-[#4f5f45] p-7 text-[#fffdf8] shadow-sm">
            <div className="text-3xl">📚</div>

            <h2 className="mt-5 text-xl font-bold">
              Got something to say?
            </h2>

            <p className="mt-2 text-sm leading-6 text-[#e5eadf]">
              Choose a book and start a conversation.
            </p>

            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="mt-5 inline-flex rounded-full bg-[#fffdf8] px-5 py-2.5 text-sm font-bold text-[#4f5f45]"
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
              className="rounded-full bg-[#4f5f45] px-5 py-2.5 text-sm font-bold text-white"
            >
              + Create post
            </button>

            <div className="flex rounded-full border border-[#d8d0c0] bg-[#fffdf8] p-1 shadow-sm">
              <button
                onClick={() => setFilter("top")}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  filter === "top"
                    ? "bg-[#4f5f45] text-white"
                    : "text-[#677060]"
                }`}
              >
                🔥 Top
              </button>

              <button
                onClick={() => setFilter("newest")}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  filter === "newest"
                    ? "bg-[#4f5f45] text-white"
                    : "text-[#677060]"
                }`}
              >
                ✨ Newest
              </button>

              <button
                onClick={() =>
                  setFilter("spoiler-free")
                }
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  filter === "spoiler-free"
                    ? "bg-[#4f5f45] text-white"
                    : "text-[#677060]"
                }`}
              >
                🌿 Spoiler-free
              </button>
            </div>
          </div>
        </div>

        {loading && (
          <div className="rounded-[28px] border border-[#ded5c4] bg-[#fffdf8] px-6 py-16 text-center">
            📖 Opening the reading room...
          </div>
        )}

        {!loading && error && (
          <div className="rounded-[28px] bg-[#fff8f5] p-10 text-center">
            {error}
          </div>
        )}

        {!loading &&
          !error &&
          filteredPosts.length === 0 && (
            <div className="rounded-[28px] border border-dashed border-[#d3cab9] bg-[#fffdf8] px-6 py-16 text-center">
              <div className="text-5xl">🪱</div>
              <h3 className="mt-5 text-xl font-bold">
                It&apos;s a little quiet in here.
              </h3>
            </div>
          )}

        <div className="space-y-5">
          {filteredPosts.map((post) => {
            const book = post.books;

            const likedByMe =
              post.discussion_likes.some(
                (like) =>
                  like.user_id === guestUserId
              );

            const expanded =
              expandedPosts.includes(post.id);

            const topComments =
              post.comments.filter(
                (comment) =>
                  !comment.parent_comment_id
              );

            return (
              <article
                key={post.id}
                className="overflow-hidden rounded-[28px] border border-[#ded5c4] bg-[#fffdf8] shadow-sm"
              >
                {book && (
                  <div className="border-b border-[#eee8dc] bg-[#fbf8f1] px-6 py-4">
                    <a
                      href={makeBookUrl(book)}
                      className="flex items-center gap-3"
                    >
                      {book.cover_url ? (
                        <img
                          src={book.cover_url}
                          alt={book.title}
                          className="h-16 w-11 rounded-md object-cover"
                        />
                      ) : (
                        <div className="flex h-16 w-11 items-center justify-center rounded-md bg-[#e5dfd1]">
                          📕
                        </div>
                      )}

                      <div>
                        <div className="text-xs font-bold uppercase tracking-[0.12em] text-[#9b8b6c]">
                          Discussing
                        </div>

                        <div className="font-bold text-[#3f4b38]">
                          {book.title}
                        </div>

                        <div className="text-sm text-[#7c8275]">
                          {book.author}
                        </div>
                      </div>
                    </a>
                  </div>
                )}

                <div className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e4e9df]">
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

                  {post.contains_spoilers &&
                  !revealedSpoilers.includes(post.id) ? (
                    <button
                      onClick={() =>
                        toggleSpoiler(post.id)
                      }
                      className="mt-5 w-full rounded-2xl border border-dashed border-[#cfc3ae] bg-[#f7f1e6] px-5 py-7"
                    >
                      🙈 This post contains spoilers — tap to
                      reveal
                    </button>
                  ) : (
                    <p className="mt-5 whitespace-pre-wrap leading-7 text-[#495046]">
                      {post.content}
                    </p>
                  )}

                  <div className="mt-6 flex items-center gap-3 border-t border-[#eee8dc] pt-4">
                    <button
                      onClick={() => toggleLike(post)}
                      disabled={
                        likingPost === post.id
                      }
                      className={`rounded-full px-4 py-2 text-sm font-bold ${
                        likedByMe
                          ? "bg-[#e5eadf] text-[#43503b]"
                          : "bg-[#f4f0e7] text-[#72786d]"
                      }`}
                    >
                      {likedByMe ? "♥" : "♡"}{" "}
                      {post.discussion_likes.length}
                    </button>

                    <button
                      onClick={() =>
                        toggleComments(post.id)
                      }
                      className="rounded-full bg-[#f4f0e7] px-4 py-2 text-sm font-bold text-[#72786d]"
                    >
                      💬 {post.comments.length}{" "}
                      {post.comments.length === 1
                        ? "comment"
                        : "comments"}
                    </button>

                    {book && (
                      <a
                        href={makeBookUrl(book)}
                        className="ml-auto text-sm font-bold text-[#56634f]"
                      >
                        View book →
                      </a>
                    )}
                  </div>

                  {expanded && (
                    <div className="mt-5 border-t border-[#eee8dc] pt-5">
                      <div className="mb-5">
                        <textarea
                          value={
                            commentDrafts[post.id] || ""
                          }
                          onChange={(event) =>
                            setCommentDrafts(
                              (current) => ({
                                ...current,
                                [post.id]:
                                  event.target.value,
                              })
                            )
                          }
                          rows={3}
                          placeholder="Add a comment..."
                          className="w-full resize-none rounded-2xl border border-[#d8d0c3] bg-white px-4 py-3 outline-none focus:border-[#829078]"
                        />

                        <div className="mt-3 flex items-center justify-between gap-3">
                          <label className="flex items-center gap-2 text-xs text-[#7d8477]">
                            <input
                              type="checkbox"
                              checked={
                                commentSpoilers[
                                  post.id
                                ] || false
                              }
                              onChange={(event) =>
                                setCommentSpoilers(
                                  (current) => ({
                                    ...current,
                                    [post.id]:
                                      event.target
                                        .checked,
                                  })
                                )
                              }
                              className="accent-[#4f5f45]"
                            />
                            Contains spoilers
                          </label>

                          <button
                            onClick={() =>
                              addComment(post.id)
                            }
                            disabled={
                              !commentDrafts[
                                post.id
                              ]?.trim() ||
                              postingComment ===
                                post.id
                            }
                            className="rounded-full bg-[#4f5f45] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                          >
                            {postingComment === post.id
                              ? "Posting..."
                              : "Comment"}
                          </button>
                        </div>
                      </div>

                      {topComments.length === 0 ? (
                        <p className="py-4 text-center text-sm text-[#969b91]">
                          No comments yet. Be the first 💬
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {topComments.map(
                            (comment) =>
                              renderComment(
                                comment,
                                post
                              )
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-8 rounded-[28px] border border-[#ded5c4] bg-[#fffdf8] px-6 py-5 text-center text-sm text-[#7a8174]">
          Posting as{" "}
          <span className="font-bold">
            {guestUsername ||
              "temporary Bookworm"}
          </span>
          . Profiles are coming later. 🐛
        </div>
      </section>

      {createOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#2c3328]/45 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeCreateModal();
            }
          }}
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[30px] bg-[#fffdf8] shadow-2xl">
            <div className="flex items-start justify-between border-b border-[#eee7da] px-7 py-5">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.14em] text-[#8a7b60]">
                  New discussion
                </div>

                <h2 className="mt-1 text-2xl font-bold text-[#394534]">
                  What&apos;s on your mind?
                </h2>
              </div>

              <button
                onClick={closeCreateModal}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f1ede4] text-xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-6 p-7">
              <div>
                <label className="mb-2 block text-sm font-bold">
                  Which book are you talking about?
                </label>

                {selectedBook ? (
                  <div className="flex items-center gap-4 rounded-2xl border border-[#ccd3c5] bg-[#f2f5ee] p-4">
                    {selectedBook.cover_url ? (
                      <img
                        src={selectedBook.cover_url}
                        alt={selectedBook.title}
                        className="h-20 w-14 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="flex h-20 w-14 items-center justify-center rounded-lg bg-[#ddd8cb]">
                        📕
                      </div>
                    )}

                    <div className="flex-1">
                      <div className="font-bold">
                        {selectedBook.title}
                      </div>
                      <div className="text-sm text-[#778071]">
                        {selectedBook.author}
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedBook(null);
                        setBookQuery("");
                      }}
                      className="rounded-full bg-white px-3 py-2 text-xs font-bold"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div>
                    <input
                      value={bookQuery}
                      onChange={(event) =>
                        setBookQuery(
                          event.target.value
                        )
                      }
                      placeholder="Search for a book..."
                      className="w-full rounded-2xl border border-[#d5cdbd] bg-white px-4 py-3.5 outline-none"
                    />

                    {bookQuery.trim().length >= 2 && (
                      <div className="mt-2 overflow-hidden rounded-2xl border bg-white shadow-lg">
                        {searchingBooks && (
                          <div className="p-4 text-sm">
                            Searching books...
                          </div>
                        )}

                        {!searchingBooks &&
                          bookResults
                            .slice(0, 6)
                            .map((book) => (
                              <button
                                key={`${book.external_id}-${book.title}`}
                                onClick={() => {
                                  setSelectedBook(
                                    book
                                  );
                                  setBookResults([]);
                                }}
                                className="flex w-full items-center gap-3 border-b p-3 text-left hover:bg-[#f7f4ed]"
                              >
                                {book.cover_url && (
                                  <img
                                    src={
                                      book.cover_url
                                    }
                                    alt={
                                      book.title
                                    }
                                    className="h-14 w-10 rounded object-cover"
                                  />
                                )}

                                <div>
                                  <div className="font-bold">
                                    {book.title}
                                  </div>
                                  <div className="text-sm text-[#7c8275]">
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

              <textarea
                value={discussionText}
                onChange={(event) =>
                  setDiscussionText(
                    event.target.value.slice(
                      0,
                      1000
                    )
                  )
                }
                rows={7}
                placeholder="Share a theory, reaction, question, unpopular opinion..."
                className="w-full resize-none rounded-2xl border border-[#d5cdbd] bg-white px-4 py-3.5 outline-none"
              />

              <label className="flex items-center gap-3 rounded-2xl border bg-[#faf7f0] p-4">
                <input
                  type="checkbox"
                  checked={containsSpoilers}
                  onChange={(event) =>
                    setContainsSpoilers(
                      event.target.checked
                    )
                  }
                  className="accent-[#4f5f45]"
                />
                ⚠️ This post contains spoilers
              </label>

              {postError && (
                <div className="rounded-xl bg-[#fff0eb] p-3 text-sm text-[#955b4c]">
                  {postError}
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={createPost}
                  disabled={posting}
                  className="rounded-full bg-[#4f5f45] px-6 py-3 font-bold text-white disabled:opacity-50"
                >
                  {posting
                    ? "Posting..."
                    : "Post discussion"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}