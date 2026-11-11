"use client";

import { useEffect, useMemo, useState } from "react";
import SiteHeader from "../components/SiteHeader";
import { ReaderName } from "../components/ReaderSocial";
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

function makeRatingUrl(book: SearchBook) {
  const params = new URLSearchParams();

  params.set("book", book.external_id);
  params.set("title", book.title);

  if (book.author) {
    params.set("author", book.author);
  }

  if (book.cover_url) {
    params.set("cover", book.cover_url);
  }

  return `/book?${params.toString()}#rate-book`;
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

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-[19px] w-[19px]"
      fill={filled ? "currentColor" : "none"}
    >
      <path
        d="M12 20.25C10.6 19.04 3 14.15 2.35 9.05C1.9 5.5 4.45 2.75 7.55 2.75C9.55 2.75 11.05 3.8 12 5.15C12.95 3.8 14.45 2.75 16.45 2.75C19.55 2.75 22.1 5.5 21.65 9.05C21 14.15 13.4 19.04 12 20.25Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function CommunityPage() {
  const [posts, setPosts] = useState<DiscussionPost[]>([]);
  const [filter, setFilter] = useState<Filter>("top");
  const [expandedTexts, setExpandedTexts] = useState<string[]>([]);

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

  const [postMenu, setPostMenu] =
    useState<string | null>(null);

  const [editingPostId, setEditingPostId] =
    useState<string | null>(null);
  const [editingPostText, setEditingPostText] = useState("");
  const [editingPostSpoiler, setEditingPostSpoiler] = useState(false);
  const [savingPostId, setSavingPostId] =
    useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);

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
      } else {
        localStorage.removeItem("nextchapter_guest_id");
        localStorage.removeItem("nextchapter_guest_username");

        if (!cancelled) {
          setGuestUserId("");
          setGuestUsername("");
        }
      }

      if (!cancelled) {
        await loadPosts();
      }
    };

    setupIdentity();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function closeMenusOnOutsideClick(event: MouseEvent) {
      const target = event.target as HTMLElement;

      if (!target.closest("[data-menu-root]")) {
        setCommentMenu(null);
        setPostMenu(null);
      }
    }

    document.addEventListener("mousedown", closeMenusOnOutsideClick);

    return () => {
      document.removeEventListener(
        "mousedown",
        closeMenusOnOutsideClick
      );
    };
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

  function openCreateModal() {
    if (!requireAccount()) return;
    setCreateOpen(true);
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

    if (!requireAccount()) {
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

  function openRateModal() {
    if (!requireAccount()) return;

    setCreateOpen(false);
    setRateOpen(true);
    setBookQuery("");
    setBookResults([]);
    setSelectedBook(null);
  }

  function closeRateModal() {
    setRateOpen(false);
    setBookQuery("");
    setBookResults([]);
    setSelectedBook(null);
  }

  async function toggleLike(post: DiscussionPost) {
    if (!requireAccount() || likingPost) return;

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
    setCommentMenu(null);
    setPostMenu(null);

    setExpandedPosts((current) =>
      current.includes(postId)
        ? current.filter((id) => id !== postId)
        : [...current, postId]
    );
  }

  async function addComment(postId: string) {
    if (!requireAccount()) return;

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
    if (!requireAccount()) return;

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

  async function saveEditedPost(post: DiscussionPost) {
    const content = editingPostText.trim();

    if (!content) return;

    setSavingPostId(post.id);

    const { error } = await supabase
      .from("discussion_posts")
      .update({
        content,
        contains_spoilers: editingPostSpoiler,
        updated_at: new Date().toISOString(),
      })
      .eq("id", post.id);

    if (!error) {
      setPosts((current) =>
        current.map((item) =>
          item.id === post.id
            ? {
                ...item,
                content,
                contains_spoilers: editingPostSpoiler,
              }
            : item
        )
      );

      setEditingPostId(null);
      setEditingPostText("");
      setEditingPostSpoiler(false);
      setPostMenu(null);
    } else {
      console.error(error);
      window.alert("Could not edit this post.");
    }

    setSavingPostId(null);
  }

  async function deletePost(post: DiscussionPost) {
    const okay = window.confirm(
      "Delete this discussion post? Its comments and likes will also be deleted."
    );

    if (!okay) return;

    const { error } = await supabase
      .from("discussion_posts")
      .delete()
      .eq("id", post.id);

    if (!error) {
      setPosts((current) =>
        current.filter((item) => item.id !== post.id)
      );

      setPostMenu(null);
      setEditingPostId(null);
    } else {
      console.error(error);
      window.alert("Could not delete this post.");
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
            ? "ml-8 bg-[#f8efeb] p-4"
            : "bg-[#fbf5f1] p-4 sm:p-5"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <ReaderName userId={comment.user_id} name={comment.username} className="font-bold text-[#5b4444]" />

              <span className="text-xs text-[#948583]">
                {timeAgo(comment.created_at)}
              </span>

              {wasEdited(comment) && (
                <span className="text-xs text-[#9b8c89]">
                  edited
                </span>
              )}

              {comment.contains_spoilers && (
                <span className="rounded-full border border-[#dcb9bb] bg-[#f3dfe0]/80 px-2 py-1 text-[10px] font-bold text-[#8f2635]">
                  SPOILER
                </span>
              )}
            </div>
          </div>

          {mine && (
            <div className="relative" data-menu-root>
              <button
                type="button"
                onClick={() => {
                  setPostMenu(null);
                  setCommentMenu(
                    commentMenu === comment.id
                      ? null
                      : comment.id
                  );
                }}
                className="rounded-full px-2 py-1 text-lg text-[#8a7b79] hover:bg-[#f3e9e5]"
              >
                •••
              </button>

              {commentMenu === comment.id && (
                <div className="absolute right-0 top-8 z-20 w-28 overflow-hidden rounded-xl border border-[#e6d8d4] bg-white shadow-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCommentId(comment.id);
                      setEditingText(comment.content);
                      setCommentMenu(null);
                    }}
                    className="block w-full px-4 py-2.5 text-left text-sm font-semibold text-[#76585a] hover:bg-[#faf3ef]"
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() => deleteComment(comment)}
                    className="block w-full px-4 py-2.5 text-left text-sm font-semibold text-[#9b3f4b] hover:bg-[#fceceb]"
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
              className="w-full resize-none rounded-xl border border-[#e4d7d2] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#b65a65]"
            />

            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() =>
                  saveEditedComment(comment)
                }
                className="rounded-full bg-[#8f2635] px-4 py-2 text-xs font-bold text-white"
              >
                Save
              </button>

              <button
                type="button"
                onClick={() => {
                  setEditingCommentId(null);
                  setEditingText("");
                }}
                className="rounded-full bg-[#f1e7e2] px-4 py-2 text-xs font-bold text-[#756866]"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : comment.contains_spoilers ? (
          <button
            type="button"
            onClick={() =>
              toggleCommentSpoiler(comment.id)
            }
            aria-expanded={revealed}
            className="mt-3 w-full rounded-xl border border-[#d6aeb1] bg-[#f3dfe0]/75 px-4 py-3 text-left transition hover:bg-[#f1d9da]/85"
          >
            {revealed ? (
              <p className="whitespace-pre-wrap text-[15px] leading-6 text-[#4f4140]">
                {comment.content}
              </p>
            ) : (
              <span className="text-sm font-semibold text-[#8f2635]">
                Contains spoilers · Tap to reveal
              </span>
            )}
          </button>
        ) : (
          <p className="mt-3 whitespace-pre-wrap text-[15px] leading-6 text-[#4f4140]">
            {comment.content}
          </p>
        )}

        {!isReply && (
          <button
            type="button"
            onClick={() => {
              setCommentMenu(null);
              setPostMenu(null);
              setReplyingTo(
                replyingTo === comment.id
                  ? null
                  : comment.id
              );
              setReplyText("");
              setReplySpoiler(false);
            }}
            className="mt-3 text-xs font-bold text-[#8f2635] hover:underline"
          >
            Reply
          </button>
        )}

        {replyingTo === comment.id && !isReply && (
          <div className="mt-4 rounded-xl border border-[#e6d8d4] bg-white p-3">
            <textarea
              value={replyText}
              onChange={(event) =>
                setReplyText(event.target.value)
              }
              placeholder={`Reply to ${comment.username}...`}
              rows={2}
              className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-[#aa9b98]"
            />

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-xs text-[#756866]">
                <input
                  type="checkbox"
                  checked={replySpoiler}
                  onChange={(event) =>
                    setReplySpoiler(event.target.checked)
                  }
                  className="accent-[#8f2635]"
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
                className="rounded-full bg-[#8f2635] px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
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
    <main className="min-h-screen overflow-x-hidden bg-[#faf6ef] text-[#2d2625]">
      <SiteHeader active="community" />

      <section className="mx-auto max-w-3xl px-4 pb-12 pt-7 sm:px-6 sm:pt-12">
        <div className="mb-6 sm:mb-8">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#a05a62] sm:text-xs">The reading room</p>
          <h1 className="aepilog-heading mt-3 text-[38px] leading-[1.08] text-[#3a2b2b] sm:text-[54px]">
            Finished the book?<br /><span className="text-[#8f2635]">Let’s talk.</span>
          </h1>
          <p className="mt-3 max-w-md text-sm leading-6 text-[#756866]">The ending. The characters. The part you can’t stop thinking about.</p>
        </div>

        <div className="mb-7 rounded-[24px] border border-[#e6d8d4] bg-[#fffdf9] p-4 sm:p-5">
          <button type="button" onClick={openCreateModal} aria-label="Start a discussion" className="group flex w-full items-center gap-3 rounded-2xl text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#8f2635]">
            <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f6e8e6] text-xl text-[#8f2635]">＋</span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-[#4f4140] sm:text-base">What did you just finish?</span><span className="mt-0.5 block text-xs leading-5 text-[#948583]">A quick reaction, a theory, an unpopular opinion…</span></span>
            <span aria-hidden="true" className="text-xl text-[#8f2635] transition group-hover:translate-x-1">→</span>
          </button>
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#eee2de] pt-3">
            <p className="text-[11px] leading-5 text-[#948583]">A few words can start a whole conversation.</p>
            <button type="button" onClick={openRateModal} className="shrink-0 rounded-full border border-[#e6d8d4] px-3 py-2 text-xs font-semibold text-[#8f2635] transition hover:bg-[#f6e8e6]">Rate a book</button>
          </div>
        </div>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="aepilog-heading text-2xl text-[#3a2b2b]">Between the pages</h2>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
            <div className="grid w-full grid-cols-3 rounded-full border border-[#e4d7d2] bg-[#fffdf9] p-1 shadow-sm sm:flex sm:w-auto sm:flex-none">
              <button
                onClick={() => setFilter("top")}
                aria-pressed={filter === "top"}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold sm:px-4 sm:py-2 sm:text-sm ${
                  filter === "top"
                    ? "bg-[#8f2635] text-white"
                    : "text-[#756866]"
                }`}
              >
                Top
              </button>

              <button
                onClick={() => setFilter("newest")}
                aria-pressed={filter === "newest"}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold sm:px-4 sm:py-2 sm:text-sm ${
                  filter === "newest"
                    ? "bg-[#8f2635] text-white"
                    : "text-[#756866]"
                }`}
              >
                Newest
              </button>

              <button
                onClick={() =>
                  setFilter("spoiler-free")
                }
                aria-pressed={filter === "spoiler-free"}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold sm:px-4 sm:py-2 sm:text-sm ${
                  filter === "spoiler-free"
                    ? "bg-[#8f2635] text-white"
                    : "text-[#756866]"
                }`}
              >
                Spoiler-free
              </button>
            </div>
          </div>
        </div>

        {loading && (
          <div className="rounded-[28px] border border-[#e6d8d4] bg-[#fffdf9] px-6 py-16 text-center">
            Opening the reading room...
          </div>
        )}

        {!loading && error && (
          <div className="rounded-[28px] bg-[#fff7f4] p-10 text-center">
            {error}
          </div>
        )}

        {!loading &&
          !error &&
          filteredPosts.length === 0 && (
            <div className="rounded-[28px] border border-dashed border-[#dfcfca] bg-[#fffdf9] px-6 py-16 text-center">
              <div className="text-5xl"></div>
              <h3 className="font-aepilog-serif mt-5 text-xl font-medium sm:text-xl">
                It&apos;s a little quiet in here.
              </h3>
            </div>
          )}

        <div className="space-y-4">
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
                id={`post-${post.id}`}
                key={post.id}
                className="scroll-mt-20 overflow-hidden rounded-[22px] border border-[#e6d8d4] bg-[#fffdf9] shadow-sm sm:rounded-[24px]"
              >
                {book && (
                  <div className="border-b border-[#eee2de] bg-[#fdf9f5] px-4 py-3 sm:px-5">
                    <a
                      href={makeBookUrl(book)}
                      className="flex items-center gap-3"
                    >
                      {book.cover_url ? (
                        <img
                          src={book.cover_url}
                          alt={book.title}
                          className="h-12 w-8 shrink-0 rounded-md object-cover"
                        />
                      ) : (
                        <div aria-hidden="true" className="flex h-12 w-8 shrink-0 items-center justify-center rounded-md bg-[#eee2de] text-[#a05a62]">
                          <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5"><path d="M6 3h12v18H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Zm0 0v14m-3 1a3 3 0 0 1 3-1h12M9 7h6m-6 4h5" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg>
                        </div>
                      )}

                      <div>
                        <div className="aepilog-heading text-lg leading-6 text-[#3a2b2b]">
                          {book.title}
                        </div>

                        <div className="mt-0.5 text-xs text-[#756866]">
                          {book.author}
                        </div>
                      </div>
                    </a>
                  </div>
                )}

                <div className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div>
                        <ReaderName userId={post.user_id} name={post.username} className="font-bold text-[#5b4444]" />

                        <div className="text-xs text-[#948583]">
                          {timeAgo(post.created_at)}
                        </div>
                      </div>
                    </div>

                    {post.user_id === guestUserId && (
                      <div className="relative" data-menu-root>
                        <button
                          type="button"
                          onClick={() => {
                            setCommentMenu(null);
                            setPostMenu(
                              postMenu === post.id
                                ? null
                                : post.id
                            );
                          }}
                          className="rounded-full px-2 py-1 text-lg text-[#8a7b79] hover:bg-[#f3e9e5]"
                        >
                          •••
                        </button>

                        {postMenu === post.id && (
                          <div className="absolute right-0 top-8 z-20 w-28 overflow-hidden rounded-xl border border-[#e6d8d4] bg-white shadow-lg">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingPostId(post.id);
                                setEditingPostText(post.content);
                                setEditingPostSpoiler(
                                  post.contains_spoilers
                                );
                                setPostMenu(null);
                              }}
                              className="block w-full px-4 py-2.5 text-left text-sm font-semibold text-[#76585a] hover:bg-[#faf3ef]"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() => deletePost(post)}
                              className="block w-full px-4 py-2.5 text-left text-sm font-semibold text-[#9b3f4b] hover:bg-[#fceceb]"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {editingPostId === post.id ? (
                    <div className="mt-5 rounded-2xl border border-[#e4d7d2] bg-[#fcf7f3] p-4">
                      <textarea
                        value={editingPostText}
                        onChange={(event) =>
                          setEditingPostText(
                            event.target.value.slice(0, 1000)
                          )
                        }
                        rows={5}
                        className="w-full resize-none rounded-xl border border-[#e4d7d2] bg-white px-4 py-3 outline-none focus:border-[#b65a65]"
                      />

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                        <label className="flex items-center gap-2 text-xs text-[#756866]">
                          <input
                            type="checkbox"
                            checked={editingPostSpoiler}
                            onChange={(event) =>
                              setEditingPostSpoiler(
                                event.target.checked
                              )
                            }
                            className="accent-[#8f2635]"
                          />
                          Contains spoilers
                        </label>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingPostId(null);
                              setEditingPostText("");
                              setEditingPostSpoiler(false);
                            }}
                            className="rounded-full bg-[#f1e7e2] px-4 py-2 text-xs font-bold text-[#756866]"
                          >
                            Cancel
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              saveEditedPost(post)
                            }
                            disabled={
                              !editingPostText.trim() ||
                              savingPostId === post.id
                            }
                            className="rounded-full bg-[#8f2635] px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                          >
                            {savingPostId === post.id
                              ? "Saving..."
                              : "Save"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : post.contains_spoilers ? (
                    <button
                      type="button"
                      onClick={() =>
                        toggleSpoiler(post.id)
                      }
                      aria-expanded={
                        revealedSpoilers.includes(post.id)
                      }
                      className="mt-4 w-full rounded-2xl border border-[#d6aeb1] bg-[#f3dfe0]/75 px-4 py-5 text-left transition hover:bg-[#f1d9da]/85"
                    >
                      {revealedSpoilers.includes(post.id) ? (
                        <p className="whitespace-pre-wrap text-[15px] leading-6 text-[#4f4140]">
                          {post.content}
                        </p>
                      ) : (
                        <span className="text-sm font-semibold text-[#8f2635]">
                          Contains spoilers · Tap to reveal
                        </span>
                      )}
                    </button>
                  ) : (
                    <div className="mt-4">
                    <p className={`whitespace-pre-wrap break-words text-base leading-7 text-[#4f4140] ${post.content.length > 220 && !expandedTexts.includes(post.id) ? "line-clamp-4" : ""}`}>
                      {post.content}
                    </p>
                    {post.content.length > 220 && <button type="button" aria-expanded={expandedTexts.includes(post.id)} onClick={() => setExpandedTexts((current) => current.includes(post.id) ? current.filter((id) => id !== post.id) : [...current, post.id])} className="mt-2 py-1 text-xs font-semibold text-[#8f2635]">{expandedTexts.includes(post.id) ? "Show less" : "Read more"}</button>}
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#eee2de] pt-3">
                    <button
                      onClick={() => toggleLike(post)}
                      aria-label={`${likedByMe ? "Unlike" : "Like"} discussion by ${post.username}`}
                      disabled={
                        likingPost === post.id
                      }
                      className={`inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold sm:px-4 ${
                        likedByMe
                          ? "bg-[#f0d7d9] text-[#7b1f2d]"
                          : "bg-[#f7eeea] text-[#756866]"
                      }`}
                    >
                      <HeartIcon filled={likedByMe} />
                      <span>{post.discussion_likes.length}</span>
                    </button>

                    <button
                      onClick={() =>
                        toggleComments(post.id)
                      }
                      aria-expanded={expanded}
                      aria-label={`Reply to discussion by ${post.username}`}
                      className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#f7eeea] px-3 py-2 text-sm font-semibold text-[#756866] sm:px-4"
                    >
                      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-4 w-4"><path d="M20 11.5a8 8 0 0 1-8 8 9 9 0 0 1-3.5-.7L4 20l1.2-4.5A8 8 0 1 1 20 11.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
                      Reply {post.comments.length > 0 && <span className="text-[#a05a62]">{post.comments.length}</span>}
                    </button>

                    {book && (
                      <a
                        href={makeBookUrl(book)}
                        className="ml-auto text-xs font-bold text-[#76585a] sm:text-sm"
                      >
                        View book →
                      </a>
                    )}
                  </div>

                  {expanded && (
                    <div className="mt-5 border-t border-[#eee2de] pt-5">
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
                          className="w-full resize-none rounded-2xl border border-[#e4d7d2] bg-white px-4 py-3 outline-none focus:border-[#b65a65]"
                        />

                        <div className="mt-3 flex items-center justify-between gap-3">
                          <label className="flex items-center gap-2 text-xs text-[#756866]">
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
                              className="accent-[#8f2635]"
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
                            className="rounded-full bg-[#8f2635] px-4 py-2 text-xs font-bold text-white sm:px-5 sm:text-sm disabled:opacity-50"
                          >
                            {postingComment === post.id
                              ? "Posting..."
                              : "Comment"}
                          </button>
                        </div>
                      </div>

                      {topComments.length === 0 ? (
                        <p className="py-4 text-center text-sm text-[#948583]">
                          No comments yet. Be the first
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

        <div className="mt-6 rounded-[20px] border border-[#e6d8d4] bg-[#fffdf9] px-4 py-3 text-center text-xs text-[#756866] sm:text-sm">
          {guestUsername ? <>Posting as <a href="/profile" className="font-semibold text-[#8f2635] hover:underline">{guestUsername}</a></> : "A reading room for every last-page feeling."}
        </div>
      </section>

      {createOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#2d2625]/45 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeCreateModal();
            }
          }}
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[30px] bg-[#fffdf9] shadow-2xl">
            <div className="flex items-start justify-between border-b border-[#eee2de] px-7 py-5">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.14em] text-[#a05a62]">
                  New discussion
                </div>

                <h2 className="font-aepilog-serif mt-1 text-2xl font-bold text-[#3a2b2b]">
                  What&apos;s on your mind?
                </h2>
              </div>

              <button
                onClick={closeCreateModal}
                aria-label="Close discussion editor"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f6eeea] text-xl"
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
                  <div className="flex items-center gap-4 rounded-2xl border border-[#e2c8c8] bg-[#fbefee] p-4">
                    {selectedBook.cover_url ? (
                      <img
                        src={selectedBook.cover_url}
                        alt={selectedBook.title}
                        className="h-20 w-14 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="flex h-20 w-14 items-center justify-center rounded-lg bg-[#eadeda]">
                        Book
                      </div>
                    )}

                    <div className="flex-1">
                      <div className="font-bold">
                        {selectedBook.title}
                      </div>
                      <div className="text-sm text-[#756866]">
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
                      className="w-full rounded-2xl border border-[#e2d4cf] bg-white px-4 py-3.5 outline-none"
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
                                className="flex w-full items-center gap-3 border-b p-3 text-left hover:bg-[#faf6ef]"
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
                                  <div className="text-sm text-[#756866]">
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
                className="w-full resize-none rounded-2xl border border-[#e2d4cf] bg-white px-4 py-3.5 outline-none"
              />

              <label className="flex items-center gap-3 rounded-2xl border bg-[#fcf7f3] p-4">
                <input
                  type="checkbox"
                  checked={containsSpoilers}
                  onChange={(event) =>
                    setContainsSpoilers(
                      event.target.checked
                    )
                  }
                  className="accent-[#8f2635]"
                />
                 This post contains spoilers
              </label>

              {postError && (
                <div className="rounded-xl bg-[#fbe6e5] p-3 text-sm text-[#9b3f4b]">
                  {postError}
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={createPost}
                  disabled={posting}
                  className="rounded-full bg-[#8f2635] px-6 py-3 font-bold text-white disabled:opacity-50"
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

      {rateOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#2d2625]/45 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeRateModal();
            }
          }}
        >
          <div className="flex h-[70dvh] max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[30px] bg-[#fffdf9] shadow-2xl sm:h-auto sm:overflow-y-auto">
            <div className="flex items-start justify-between border-b border-[#eee2de] px-7 py-5">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.14em] text-[#a05a62]">
                  Your reading history
                </div>

                <h2 className="font-aepilog-serif mt-1 text-2xl font-bold text-[#3a2b2b]">
                  Rate a book
                </h2>

                <p className="mt-2 text-sm text-[#756866]">
                  Search for a book, then jump straight to its rating.
                </p>
              </div>

              <button
                type="button"
                onClick={closeRateModal}
                aria-label="Close rating editor"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f6eeea] text-xl"
              >
                ×
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col p-7">
              <label className="mb-2 block text-sm font-bold">
                Which book do you want to rate?
              </label>

              <input
                value={bookQuery}
                onChange={(event) => {
                  setSelectedBook(null);
                  setBookQuery(event.target.value);
                }}
               
                placeholder="Search for a book..."
                className="w-full rounded-2xl border border-[#e2d4cf] bg-white px-4 py-3.5 outline-none focus:border-[#b65a65]"
              />

              {bookQuery.trim().length >= 2 && (
                <div className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-2xl border border-[#eaded9] bg-white shadow-lg sm:flex-none sm:overflow-hidden">
                  {searchingBooks && (
                    <div className="p-4 text-sm text-[#756866]">
                      Searching books...
                    </div>
                  )}

                  {!searchingBooks && bookResults.length === 0 && (
                    <div className="p-4 text-sm text-[#8a7b79]">
                      No books found yet. Try another title or author.
                    </div>
                  )}

                  {!searchingBooks &&
                    bookResults.slice(0, 6).map((book) => (
                      <a
                        key={`${book.external_id}-${book.title}`}
                        href={makeRatingUrl(book)}
                        className="flex w-full items-center gap-3 border-b border-[#eee2de] p-3 text-left transition last:border-b-0 hover:bg-[#faf6ef]"
                      >
                        {book.cover_url ? (
                          <img
                            src={book.cover_url}
                            alt={book.title}
                            className="h-14 w-10 rounded object-cover"
                          />
                        ) : (
                          <div className="flex h-14 w-10 shrink-0 items-center justify-center rounded bg-[#eee2de]">
                            Book
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="font-aepilog-serif font-semibold text-[#3a2b2b]">
                            {book.title}
                          </div>
                          <div className="text-sm text-[#756866]">
                            {book.author}
                          </div>
                        </div>

                        <span className="shrink-0 text-sm font-bold text-[#8f2635]">
                          Rate →
                        </span>
                      </a>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
