"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { accountUser } from "@/lib/readers";
import { discussionHref } from "@/lib/discussion-links";
import SiteHeader from "./SiteHeader";
import BackLink from "./BackLink";
import { fetchJsonWithTimeout } from "@/lib/fetch-json";
import AnimatedLikeButton from "./AnimatedLikeButton";
import { ReaderName, ReaderDisplayName } from "./ReaderSocial";
import { supabase } from "@/lib/supabase";
import { COMMUNITY_GENRES, bookTopicKey, browseText, matchesCommunityGenre } from "@/lib/community-browse";
import { useBookTopics } from "./useBookTopics";
import { ensureCommunityBook, type BookChoice, type AttachedBook } from "@/lib/community-books";
import { POLL_FIELDS, pollFromPost, pollTotal, discussionEngagement, type BookPoll } from "@/lib/book-polls";
import AttachedBookCard from "./AttachedBookCard";
import BookPollComposer from "./BookPollComposer";
import BookPollCard from "./BookPollCard";
import ReplyBookPicker from "./ReplyBookPicker";

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
  recommended_book?: AttachedBook | null;
};

type DiscussionPost = {
  id: string;
  book_id: string | null;
  user_id: string;
  username: string;
  content: string;
  contains_spoilers: boolean;
  created_at: string;
  books: Book | null;
  discussion_likes: Like[];
  comments: Comment[];
  book_polls?: BookPoll | BookPoll[] | null;
};

type Filter = "top" | "newest";

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


type FeedSnapshot = { posts: DiscussionPost[]; filter: Filter; genre: string; authorQuery: string; spoilerFree: boolean; browseOpen: boolean; path: string; scroll: number; restore: boolean; until: number };
// Public feed data only, scoped to this browser tab; never persisted or shared by SSR.
let feedSnapshot: FeedSnapshot | null = null;
function recentFeed() {
  return typeof window !== "undefined" && feedSnapshot && feedSnapshot.until > Date.now() ? feedSnapshot : null;
}

export default function CommunityScreen({ discussionId }: { discussionId?: string }) {
  const router = useRouter();
  const [initialFeed] = useState(() => !discussionId ? recentFeed() : null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "manual">("idle");
  const [refreshError, setRefreshError] = useState("");

  const [posts, setPosts] = useState<DiscussionPost[]>(initialFeed?.posts || []);
  const [filter, setFilter] = useState<Filter>(initialFeed?.filter || "top");
  const [postType, setPostType] = useState<"post" | "poll">("post");
  const [pollBusy, setPollBusy] = useState(false);
  const [myPollVotes, setMyPollVotes] = useState<Record<string, string>>({});
  const [commentBooks, setCommentBooks] = useState<Record<string, BookChoice | null>>({});
  const [bookPickers, setBookPickers] = useState<Record<string, boolean>>({});
  const [replyBook, setReplyBook] = useState<BookChoice | null>(null);
  const [replyPicker, setReplyPicker] = useState(false);
  const [commentErrors, setCommentErrors] = useState<Record<string, string>>({});
  const [browseOpen, setBrowseOpen] = useState(initialFeed?.browseOpen || false);
  const [genre, setGenre] = useState(initialFeed?.genre || "");
  const [authorQuery, setAuthorQuery] = useState(initialFeed?.authorQuery || "");
  const [spoilerFree, setSpoilerFree] = useState(initialFeed?.spoilerFree || false);
  const activeFilters = Number(!!genre) + Number(!!authorQuery.trim()) + Number(spoilerFree);
  const topicBooks = useMemo(() => posts.flatMap((post) => {
    const poll = pollFromPost(post.book_polls);
    return (poll ? [poll.left_book, poll.right_book] : [post.books]).filter((book): book is Book => !!book && browseText(book.author || "").includes(browseText(authorQuery)));
  }), [posts, authorQuery]);
  const bookTopics = useBookTopics(topicBooks, !!genre);

  const [loading, setLoading] = useState(!initialFeed);
  const [error, setError] = useState("");
  const openedAnchor = useRef("");
  useEffect(() => {
    if (loading) return;
    const id = window.location.hash.slice(1);
    if (!/^(post|comment)-[0-9a-f-]{36}$/i.test(id) || openedAnchor.current === id) return;
    const post = document.getElementById(id);
    if (post) { openedAnchor.current = id; requestAnimationFrame(() => post.scrollIntoView({ block: "start" })); }
  });

  const [guestUserId, setGuestUserId] = useState("");
  const [guestUsername, setGuestUsername] = useState("");
  const pollIds = posts.flatMap((post) => pollFromPost(post.book_polls)?.post_id || []).sort().join(",");
  useEffect(() => {
    if (!guestUserId || !pollIds) return;
    let current = true;
    const controller = new AbortController();
    void (async () => {
      const { data, error } = await supabase.from("book_poll_votes").select("poll_id,choice").eq("user_id", guestUserId).in("poll_id", pollIds.split(",")).abortSignal(controller.signal);
      if (current && !error) setMyPollVotes((previous) => ({ ...Object.fromEntries((data || []).map((row) => [row.poll_id, row.choice])), ...previous }));
    })();
    return () => { current = false; controller.abort(); };
  }, [guestUserId, pollIds]);

  const [revealedSpoilers, setRevealedSpoilers] = useState<string[]>([]);
  const [revealedCommentSpoilers, setRevealedCommentSpoilers] =
    useState<string[]>([]);

  const [likingPost, setLikingPost] = useState<string | null>(null);


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
  const [bookSearchError, setBookSearchError] = useState("");
  const [likeErrors, setLikeErrors] = useState<Record<string, string>>({});
  const [discussionText, setDiscussionText] = useState("");
  const [containsSpoilers, setContainsSpoilers] =
    useState(false);

  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState("");

  useEffect(() => {
    if (typeof window === "undefined" || loading || error) return;
    if (!discussionId) {
      feedSnapshot = { posts, filter, genre, authorQuery, spoilerFree, browseOpen, path: window.location.pathname,
        scroll: feedSnapshot?.scroll || 0, restore: false, until: Date.now() + 300000 };
    } else if (feedSnapshot && posts.length === 1) {
      feedSnapshot = { ...feedSnapshot, posts: feedSnapshot.posts.map((post) => post.id === posts[0].id ? posts[0] : post) };
    }
  }, [discussionId, posts, filter, genre, authorQuery, spoilerFree, browseOpen, loading, error]);

  useEffect(() => {
    if (!initialFeed?.restore) return;
    const frame = requestAnimationFrame(() => window.scrollTo(0, initialFeed.scroll));
    return () => cancelAnimationFrame(frame);
  }, [initialFeed]);

  function rememberFeedPosition() {
    if (feedSnapshot) feedSnapshot = { ...feedSnapshot, scroll: window.scrollY, path: window.location.pathname };
  }

  async function copyDiscussionLink() {
    if (!discussionId) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(window.location.origin + discussionHref(discussionId));
      setCopyState("copied");
    } catch { setCopyState("manual"); }
  }


  useEffect(() => {
    let cancelled = false;

    const setupIdentity = async () => {
      const authUser = await accountUser();

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
        await loadPosts(!!initialFeed);
      }
    };

    setupIdentity();

    return () => {
      cancelled = true;
    };
  }, [discussionId]);

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
    const trimmed = bookQuery.trim();
    if (selectedBook || (!createOpen && !rateOpen) || trimmed.length < 2) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => { void searchBooks(trimmed, controller.signal); }, 350);
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [bookQuery, selectedBook, createOpen, rateOpen]);

  function changeBookQuery(value: string) {
    setBookQuery(value); setBookResults([]); setBookSearchError("");
    setSearchingBooks(value.trim().length >= 2);
  }

  async function loadPosts(background = false) {
    if (!background) setLoading(true);
    setError(""); setRefreshError("");

    let request = supabase
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
        book_polls (${POLL_FIELDS}),
        discussion_likes (
          id,
          user_id
        ),
        comments (${discussionId ? "id,post_id,user_id,username,content,contains_spoilers,parent_comment_id,created_at,updated_at,recommended_book:books!comments_recommended_book_id_fkey(id,external_id,title,author,cover_url)" : "id,created_at"})
      `);
    if (discussionId) request = request.eq("id", discussionId).limit(1);
    const { data, error } = await request.order("created_at", { ascending: false }).abortSignal(AbortSignal.timeout(12000));

    if (error) {
      console.error(error);
      if (background) setRefreshError("Could not refresh discussions. Your current feed is still here.");
      else setError(discussionId ? "Could not load this discussion. Please try again." : "Could not load the community right now.");
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

  async function searchBooks(query: string, signal: AbortSignal) {
    try {
      const data = await fetchJsonWithTimeout(`/api/books/search?q=${encodeURIComponent(query)}`, { signal }, 12000);
      if (!signal.aborted) setBookResults(normalizeSearchResults(data));
    } catch {
      if (!signal.aborted) setBookSearchError("Book search is unavailable. Please try again.");
    } finally { if (!signal.aborted) setSearchingBooks(false); }
  }

  async function findOrCreateBook(searchBook: SearchBook) {
    return ensureCommunityBook(searchBook);
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
    setPostType("post");
    setCreateOpen(true);
  }

  async function createPost() {
    setPostError("");

    if (!discussionText.trim()) {
      setPostError("Write something before posting.");
      return;
    }

    if (!requireAccount()) {
      return;
    }

    setPosting(true);

    try {
      const book = selectedBook ? await findOrCreateBook(selectedBook) : null;

      const { data: newPost, error: insertError } =
        await supabase
          .from("discussion_posts")
          .insert({
            book_id: book?.id ?? null,
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
      changeBookQuery("");
      setBookResults([]);
      setSelectedBook(null);
      setCreateOpen(false);
      setFilter("newest");
      if (feedSnapshot) feedSnapshot = { ...feedSnapshot, posts: [completePost, ...feedSnapshot.posts.filter((item) => item.id !== completePost.id)], filter: "newest", scroll: 0 };
      router.push(discussionHref(completePost.id));
    } catch (error) {
      console.error(error);
      setPostError("Could not publish your post.");
    } finally {
      setPosting(false);
    }
  }

  function closeCreateModal() {
    if (posting || pollBusy) return;

    setCreateOpen(false);
    changeBookQuery("");
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
    changeBookQuery("");
    setBookResults([]);
    setSelectedBook(null);
  }

  function closeRateModal() {
    setRateOpen(false);
    changeBookQuery("");
    setBookResults([]);
    setSelectedBook(null);
  }

  async function toggleLike(post: DiscussionPost) {
    if (!requireAccount() || likingPost) return;
    setLikingPost(post.id); setLikeErrors((current) => ({ ...current, [post.id]: "" }));
    try {
      const signal = AbortSignal.timeout(10000);
      const existing = post.discussion_likes.find((like) => like.user_id === guestUserId);
      if (existing) {
        const result = await supabase.from("discussion_likes").delete().eq("id", existing.id).abortSignal(signal);
        if (result.error) throw result.error;
        setPosts((current) => current.map((item) => item.id === post.id ? { ...item,
          discussion_likes: item.discussion_likes.filter((like) => like.id !== existing.id) } : item));
      } else {
        const result = await supabase.from("discussion_likes").insert({ post_id: post.id, user_id: guestUserId })
          .select("id,user_id").abortSignal(signal).single();
        if (result.error || !result.data) throw result.error || new Error("Like not saved");
        setPosts((current) => current.map((item) => item.id === post.id ? { ...item,
          discussion_likes: [...item.discussion_likes, result.data as Like] } : item));
      }
    } catch { setLikeErrors((current) => ({ ...current, [post.id]: "Could not save your like. Please try again." })); }
    finally { setLikingPost(null); }
  }

  async function publishComment(postId: string, parentId: string | null, text: string, choice: BookChoice | null, spoiler: boolean) {
    if (!requireAccount() || postingComment) return false;
    const content = text.trim() || choice?.title || "";
    if (!content) return false;
    const key = parentId || postId;
    setPostingComment(key); setCommentErrors((current) => ({ ...current, [key]: "" }));
    try {
      const book = choice ? await findOrCreateBook(choice) : null;
      const { data, error } = await supabase.from("comments").insert({
        post_id: postId, user_id: guestUserId, username: guestUsername, content,
        contains_spoilers: spoiler, parent_comment_id: parentId, recommended_book_id: book?.id || null,
      }).select("id,post_id,user_id,username,content,contains_spoilers,parent_comment_id,created_at,updated_at,recommended_book:books!comments_recommended_book_id_fkey(id,external_id,title,author,cover_url)").single();
      if (error) throw error;
      setPosts((current) => current.map((post) => post.id === postId ? { ...post, comments: [...post.comments, data as unknown as Comment] } : post));
      return true;
    } catch { setCommentErrors((current) => ({ ...current, [key]: "Could not post this reply. Your draft is still here. Please try again." })); return false; }
    finally { setPostingComment(null); }
  }

  async function addComment(postId: string) {
    if (!await publishComment(postId, null, commentDrafts[postId] || "", commentBooks[postId] || null, commentSpoilers[postId] || false)) return;
    setCommentDrafts((current) => ({ ...current, [postId]: "" }));
    setCommentSpoilers((current) => ({ ...current, [postId]: false }));
    setCommentBooks((current) => ({ ...current, [postId]: null }));
    setBookPickers((current) => ({ ...current, [postId]: false }));
    setComposerOpen(false);
  }

  async function addReply(postId: string, parentCommentId: string) {
    if (!await publishComment(postId, parentCommentId, replyText, replyBook, replySpoiler)) return;
    setReplyText(""); setReplySpoiler(false); setReplyingTo(null); setReplyBook(null); setReplyPicker(false);
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
      .update(pollFromPost(post.book_polls) ? { contains_spoilers: editingPostSpoiler, updated_at: new Date().toISOString() } : {
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

      if (feedSnapshot) feedSnapshot = { ...feedSnapshot, posts: feedSnapshot.posts.filter((item) => item.id !== post.id), restore: true };
      if (discussionId) router.replace(recentFeed()?.path || "/");
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
    if (discussionId) return posts;
    let result = [...posts];

    if (spoilerFree) {
      result = result.filter(
        (post) => !post.contains_spoilers
      );
    }

    result = result.filter((post) => {
      const poll = pollFromPost(post.book_polls);
      const books = (poll ? [poll.left_book, poll.right_book] : [post.books]).filter((book): book is Book => !!book);
      return books.some((book) => (!authorQuery.trim() || browseText(book.author || "").includes(browseText(authorQuery))) && (!genre || matchesCommunityGenre(genre, bookTopics.topics[bookTopicKey(book)] || []))) || (!genre && !authorQuery.trim() && !books.length);
    });

    if (filter === "top") {
      result.sort((a, b) => {
        const scoreA =
          discussionEngagement(a);

        const scoreB =
          discussionEngagement(b);

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
  }, [discussionId, posts, filter, spoilerFree, authorQuery, genre, bookTopics.topics]);

  const featuredPost = useMemo(() => {
    if (filteredPosts.length === 0) return null;

    return [...filteredPosts].sort((a, b) => {
      const scoreA =
        discussionEngagement(a);
      const scoreB =
        discussionEngagement(b);

      if (scoreB === scoreA) {
        return (
          new Date(b.created_at).getTime() -
          new Date(a.created_at).getTime()
        );
      }

      return scoreB - scoreA;
    })[0];
  }, [filteredPosts]);

  const totalComments = useMemo(
    () => filteredPosts.reduce((total, post) => total + post.comments.length, 0),
    [filteredPosts]
  );
  const featuredBook = featuredPost?.contains_spoilers && pollFromPost(featuredPost.book_polls) ? null : featuredPost?.books;
  const featuredPoll = featuredPost ? pollFromPost(featuredPost.book_polls) : null;

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
        id={`comment-${comment.id}`}
        data-comment-id={comment.id}
        className={`relative rounded-2xl ${
          isReply
            ? "ml-8 bg-[#f8efeb] p-4"
            : "bg-[#fbf5f1] p-4 sm:p-5"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <ReaderName userId={comment.user_id} name={comment.username} className="min-w-0 font-medium text-[#5b4444]" />
              <div className="flex shrink-0 items-center gap-1">
                <time dateTime={comment.created_at} className="text-xs text-[#948583]">{timeAgo(comment.created_at)}</time>
                {wasEdited(comment) && <span className="text-xs text-[#9b8c89]">edited</span>}
              </div>
            </div>
            {comment.contains_spoilers && <span className="mt-2 inline-block rounded-full border border-[#dcb9bb] bg-[#f3dfe0]/80 px-2 py-1 text-[10px] font-medium text-[#8f2635]">SPOILER</span>}
          </div>

          {mine && (
            <div className="relative" data-menu-root>
              <button
                type="button"
                aria-label="Comment actions"
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
        ) : comment.recommended_book?.title === comment.content ? null : (
          <p className="mt-3 whitespace-pre-wrap text-[15px] leading-6 text-[#4f4140]">
            {comment.content}
          </p>
        )}

        {comment.recommended_book && (!comment.contains_spoilers || revealed) && <AttachedBookCard book={comment.recommended_book} />}

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
              setReplyBook(null); setReplyPicker(false);
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

            <ReplyBookPicker open={replyPicker} onOpenChange={setReplyPicker} value={replyBook} onChange={setReplyBook} disabled={postingComment === comment.id} />
            {commentErrors[comment.id] && <p role="alert" className="mt-2 text-xs text-[#8f2635]">{commentErrors[comment.id]}</p>}
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
                  (!replyText.trim() && !replyBook) ||
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

      <section className={`mx-auto px-4 py-5 sm:px-5 sm:py-7 ${discussionId ? "max-w-3xl" : "max-w-6xl"}`}>
        {discussionId && <div className="mb-5">
          <div className="flex items-center justify-between gap-3">
            <BackLink fallback={recentFeed()?.path || "/"} onBack={() => { if (feedSnapshot) feedSnapshot = { ...feedSnapshot, restore: true }; }} className="py-2 text-sm font-medium underline underline-offset-4" />
            <button type="button" onClick={() => void copyDiscussionLink()} className="rounded-full border border-[#e6d8d4] bg-[#fffdf9] px-4 py-2 text-sm">{copyState === "copied" ? "Link copied" : "Copy link"}</button>
          </div>
          <h1 className="aepilog-heading mt-3 text-3xl font-medium">Discussion</h1>
          {copyState === "manual" && <label className="mt-3 block text-sm">Copy this discussion link<input aria-label="Discussion link" readOnly value={typeof window !== "undefined" ? window.location.origin + discussionHref(discussionId) : ""} onFocus={(event) => event.target.select()} className="mt-2 w-full rounded-xl border border-[#e6d8d4] bg-[#fffdf9] px-3 py-2" /></label>}
          {copyState === "copied" && <p role="status" className="sr-only">Discussion link copied.</p>}
        </div>}
        {!discussionId && <>
        <div className="mb-4 flex justify-end"><Link href="/buddy-reads" className="rounded-full border border-[#e6d8d4] bg-[#fffdf9] px-4 py-2 text-sm text-[#8f2635]">Buddy reads →</Link></div>
        <div className="mb-5 grid gap-4 lg:grid-cols-[1fr_280px]">
          <div className="rounded-[20px] border border-[#e6d8d4] bg-[#fffdf9] p-4 shadow-sm sm:rounded-[24px] sm:p-6">
            <div className="inline-flex rounded-full bg-[#f6e8e6] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#8f2635] sm:text-xs">
              Community
            </div>

            <div className="mt-3 flex items-start justify-between gap-4">
              <div>
                <h1 className="font-aepilog-serif text-[28px] font-medium leading-[1.08] text-[#3a2b2b] sm:text-4xl">
                  Book discussions
                </h1>

                <p className="mt-1.5 hidden max-w-2xl text-sm leading-5 text-[#756866] sm:block">
                  Browse posts about books.
                </p>
              </div>

              {!loading && !error && (
                <div className="hidden shrink-0 items-center gap-2 md:flex">
                  <div className="rounded-full border border-[#eaded9] bg-[#fbf5f1] px-3 py-1.5 text-xs font-semibold text-[#756866]">
                    <span className="text-[#8f2635]">{filteredPosts.length}</span>{" "}
                    {filteredPosts.length === 1 ? "discussion" : "discussions"}
                  </div>
                  <div className="rounded-full border border-[#eaded9] bg-[#fbf5f1] px-3 py-1.5 text-xs font-semibold text-[#756866]">
                    <span className="text-[#8f2635]">{totalComments}</span>{" "}
                    {totalComments === 1 ? "comment" : "comments"}
                  </div>
                </div>
              )}
            </div>

            {!loading && !error && featuredPost ? (
              <Link
                href={discussionHref(featuredPost.id)}
                onClick={rememberFeedPosition}
                className="mt-4 flex items-center gap-3 rounded-2xl border border-[#eaded9] bg-[#fbf5f1] p-3 transition hover:border-[#c99ba0] hover:bg-[#f8efeb]"
              >
                {featuredBook && (featuredBook.cover_url ? (
                  <img
                    src={featuredBook.cover_url}
                    alt={featuredBook.title}
                    className="h-20 w-14 shrink-0 rounded-lg object-cover shadow-sm"
                  />
                ) : (
                  <div className="flex h-20 w-14 shrink-0 items-center justify-center rounded-lg bg-[#eee2de] text-xs font-bold text-[#756866]">
                    Book
                  </div>
                ))}

                <div className="min-w-0 flex-1">
                  <div className="text-xs text-[#756866]">
                    <ReaderDisplayName name={featuredPost.username} />
                  </div>
                  <p className="mt-1 line-clamp-3 break-words text-xl font-medium leading-snug text-[#3a2b2b] sm:text-2xl">
                    {featuredPost.contains_spoilers
                      ? "This discussion contains spoilers."
                      : featuredPost.content}
                  </p>
                  {(featuredPoll || featuredBook) && <div className="mt-2 text-sm text-[#756866]">
                    {featuredPoll && !featuredPost.contains_spoilers ? `${featuredPoll.left_book?.title || "Book"} vs ${featuredPoll.right_book?.title || "book"}` : featuredBook?.title || "Book vs book"}
                  </div>}
                  <div className="mt-2 text-xs font-semibold text-[#8f2635]">
                    {featuredPost.discussion_likes.length} likes · {featuredPost.comments.length} {featuredPost.comments.length === 1 ? "comment" : "comments"}{pollFromPost(featuredPost.book_polls) && <> · {pollTotal(pollFromPost(featuredPost.book_polls))} votes</>} · View discussion
                  </div>
                </div>
              </Link>
            ) : !loading && !error && !activeFilters ? (
              <div className="mt-6 rounded-2xl border border-dashed border-[#e4d7d2] bg-[#fcf7f3] p-5 text-sm leading-6 text-[#756866]">
                {activeFilters ? "No matching discussions." : "No discussions yet."}
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
            <div className="rounded-[22px] border border-[#e6d8d4] bg-[#8f2635] p-4 text-[#fffdf9] shadow-sm sm:p-5">
              <h2 className="font-aepilog-serif text-[18px] font-medium leading-tight sm:text-xl">
                Start a discussion
              </h2>

              <p className="mt-1.5 hidden text-sm leading-5 text-[#f0d7d9] lg:block">
                Ask a question or share a thought.
              </p>

              <button
                type="button"
                onClick={() => openCreateModal()}
                className="mt-3 inline-flex rounded-full bg-[#fffdf9] px-3 py-2 text-[11px] font-bold text-[#8f2635] sm:px-4 sm:text-sm"
              >
                + Create post
              </button>
            </div>

            <div className="flex h-full min-h-[132px] flex-col rounded-[22px] border border-[#8f2635] bg-[#fffdf9] p-4 text-[#8f2635] shadow-sm sm:min-h-0 sm:p-5 lg:block lg:h-auto">
              <h2 className="font-aepilog-serif text-[18px] font-medium leading-tight sm:text-xl">
                Rate a book
              </h2>

              <p className="mt-1.5 hidden text-sm leading-5 text-[#756866] lg:block">
                Add your rating.
              </p>

              <button
                type="button"
                onClick={openRateModal}
                className="mt-auto inline-flex w-fit rounded-full bg-[#8f2635] px-3 py-2 text-[11px] font-bold text-[#fffdf9] sm:px-4 sm:text-sm lg:mt-3"
              >
                Add a rating
              </button>
            </div>
          </div>
        </div>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-aepilog-serif text-2xl font-medium text-[#3a2b2b] sm:text-2xl">
              Discussions
            </h2>

          </div>

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

              <button type="button" onClick={() => setBrowseOpen((value) => !value)} aria-expanded={browseOpen} aria-controls="community-filters" className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold sm:px-4 sm:py-2 sm:text-sm ${browseOpen || activeFilters ? "bg-[#f6e8e6] text-[#8f2635]" : "text-[#756866]"}`}>
                Filters{activeFilters ? ` (${activeFilters})` : ""}
              </button>
            </div>
          </div>
        </div>

        {browseOpen && <div id="community-filters" className="aepilog-reveal mb-4 rounded-2xl border border-[#e6d8d4] bg-[#fffdf9] p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-semibold text-[#756866]">Genre
              <select aria-label="Genre" value={genre} onChange={(event) => setGenre(event.target.value)} className="mt-2 block w-full rounded-xl border border-[#e6d8d4] bg-white px-3 py-3 text-sm text-[#3a2b2b]">
                <option value="">All genres</option>{Object.keys(COMMUNITY_GENRES).map((value) => <option key={value}>{value}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-[#756866]">Author
              <input type="search" value={authorQuery} onChange={(event) => setAuthorQuery(event.target.value)} placeholder="Any author" list="community-authors" className="mt-2 block w-full rounded-xl border border-[#e6d8d4] bg-white px-3 py-3 text-sm text-[#3a2b2b]" />
              <datalist id="community-authors">{[...new Set(posts.map((post) => post.books?.author).filter(Boolean))].map((author) => <option key={author} value={author!} />)}</datalist>
            </label>
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm text-[#756866]"><input type="checkbox" checked={spoilerFree} onChange={(event) => setSpoilerFree(event.target.checked)} className="accent-[#8f2635]" />Spoiler-free only</label>
        </div>}
        {activeFilters > 0 && <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-[#756866]"><span>{[genre, authorQuery.trim(), spoilerFree ? "Spoiler-free" : ""].filter(Boolean).join(" · ")}</span><button type="button" onClick={() => { setGenre(""); setAuthorQuery(""); setSpoilerFree(false); }} className="py-2 font-semibold text-[#8f2635] underline">Clear filters</button></div>}
        {!!genre && bookTopics.loading && <p role="status" className="mb-4 text-xs text-[#756866]">Checking book genres…</p>}
        {!!genre && !bookTopics.loading && (bookTopics.failed || topicBooks.some((book) => !bookTopics.topics[bookTopicKey(book)]?.length)) && <p className="mb-4 text-xs leading-5 text-[#756866]">Some books have no genre information yet.{bookTopics.failed && <> <button type="button" onClick={bookTopics.retry} className="text-[#8f2635] underline">Try again</button></>}</p>}

        </>}

        {loading && (
          <div className="rounded-[28px] border border-[#e6d8d4] bg-[#fffdf9] px-6 py-16 text-center">
            Loading discussions...
          </div>
        )}

        {!loading && error && (
          <div className="rounded-[28px] bg-[#fff7f4] p-10 text-center">
            {error} <button type="button" onClick={() => void loadPosts()} className="ml-2 underline">Try again</button>
          </div>
        )}

        {!loading &&
          !error &&
          !(genre && bookTopics.loading) &&
          filteredPosts.length === 0 && (
            <div className="rounded-[28px] border border-dashed border-[#dfcfca] bg-[#fffdf9] px-6 py-16 text-center">
              <div className="text-5xl"></div>
              <h3 className="font-aepilog-serif mt-5 text-xl font-medium sm:text-xl">
                {discussionId ? "Discussion not found" : activeFilters ? "No discussions match these filters." : "No discussions yet."}
              </h3>
            </div>
          )}

        {refreshError && <p role="alert" className="mb-4 text-sm text-[#8f2635]">{refreshError} <button type="button" onClick={() => void loadPosts(true)} className="underline">Try again</button></p>}
        <div className="space-y-4">
          {filteredPosts.map((post) => {
            const book = post.books;
            const poll = pollFromPost(post.book_polls);

            const likedByMe =
              post.discussion_likes.some(
                (like) =>
                  like.user_id === guestUserId
              );

            const expanded = !!discussionId;

            const topComments =
              post.comments.filter(
                (comment) =>
                  !comment.parent_comment_id
              );

            return (
              <article
                id={`post-${post.id}`}
                key={post.id}
                className="scroll-mt-36 overflow-hidden rounded-[22px] border border-[#e6d8d4] bg-[#fffdf9] shadow-sm sm:scroll-mt-28 sm:rounded-[24px]"
              >
                {book && !poll && (
                  <div className="border-b border-[#eee2de] bg-[#fdf9f5] px-4 py-3 sm:px-5">
                    <a
                      href={makeBookUrl(book)}
                      className="flex items-center gap-3"
                    >
                      {book.cover_url ? (
                        <img
                          src={book.cover_url}
                          alt={book.title}
                          className="h-14 w-10 rounded-md object-cover"
                        />
                      ) : (
                        <div className="flex h-14 w-10 items-center justify-center rounded-md bg-[#eee2de]">
                          Book
                        </div>
                      )}

                      <div>
                        <div className="text-xs font-bold uppercase tracking-[0.12em] text-[#a05a62]">
                          Discussing
                        </div>

                        <div className="font-aepilog-serif font-semibold text-[#3a2b2b]">
                          {book.title}
                        </div>

                        <div className="text-sm text-[#756866]">
                          {book.author}
                        </div>
                      </div>
                    </a>
                  </div>
                )}

                <div className="p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                        <ReaderName userId={post.user_id} name={post.username} className="min-w-0 font-medium text-[#5b4444]" />

                        <time dateTime={post.created_at} className="shrink-0 text-xs font-medium text-[#948583]">
                          {timeAgo(post.created_at)}
                        </time>
                    </div>

                    {post.user_id === guestUserId && (
                      <div className="relative" data-menu-root>
                        <button
                          type="button"
                          aria-label="Discussion actions"
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
                              {poll ? "Edit spoiler setting" : "Edit"}
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
                        readOnly={!!poll}
                        onChange={(event) =>
                          setEditingPostText(
                            event.target.value.slice(0, 1000)
                          )
                        }
                        rows={5}
                        className="w-full resize-none rounded-xl border border-[#e4d7d2] bg-white px-4 py-3 outline-none focus:border-[#b65a65]"
                      />
                      {poll && <p className="mt-2 text-xs text-[#756866]">Poll questions and books are fixed after posting.</p>}

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
                  ) : !discussionId ? (
                    <Link href={discussionHref(post.id)} onClick={rememberFeedPosition} className="mt-4 block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#8f2635]">
                      {post.contains_spoilers ? <p className="rounded-2xl border border-[#d6aeb1] bg-[#f3dfe0]/75 px-4 py-5 text-sm font-medium text-[#8f2635]">Contains spoilers · Open discussion</p> : <p className="line-clamp-4 whitespace-pre-wrap break-words text-lg leading-7 text-[#4f4140]">{post.content}</p>}
                      <span className="mt-2 inline-block text-xs font-medium text-[#8f2635]">Read discussion →</span>
                    </Link>
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
                        <p className="whitespace-pre-wrap break-words text-lg leading-7 text-[#4f4140]">
                          {post.content}
                        </p>
                      ) : (
                        <span className="text-sm font-semibold text-[#8f2635]">
                          Contains spoilers · Tap to reveal
                        </span>
                      )}
                    </button>
                  ) : (
                    <p className="mt-4 whitespace-pre-wrap break-words text-lg leading-7 text-[#4f4140]">
                      {post.content}
                    </p>
                  )}

                  {poll && (!post.contains_spoilers || revealedSpoilers.includes(post.id)) && <BookPollCard poll={poll} choice={myPollVotes[post.id] || null} onChoice={(choice) => setMyPollVotes((current) => ({ ...current, [post.id]: choice }))} onUpdate={(updated) => setPosts((current) => current.map((item) => item.id === post.id ? { ...item, book_polls: updated } : item))} />}

                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#eee2de] pt-3">
                    <AnimatedLikeButton
                      liked={likedByMe}
                      onClick={() => toggleLike(post)}
                      disabled={!!likingPost}
                      aria-busy={likingPost === post.id}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold sm:px-4 sm:py-2 sm:text-sm ${
                        likedByMe
                          ? "bg-[#f0d7d9] text-[#7b1f2d]"
                          : "bg-[#f7eeea] text-[#756866]"
                      }`}
                    >
                      <span>{post.discussion_likes.length}</span>
                    </AnimatedLikeButton>

                    <Link href={discussionId ? "#comments" : discussionHref(post.id)} onClick={!discussionId ? rememberFeedPosition : undefined} className="rounded-full bg-[#f7eeea] px-3 py-1.5 text-xs font-medium sm:px-4 sm:py-2 sm:text-sm">
                      {post.comments.length} {post.comments.length === 1 ? "comment" : "comments"}
                    </Link>

                    {book && !poll && (
                      <a
                        href={makeBookUrl(book)}
                        className="ml-auto text-xs font-bold text-[#76585a] sm:text-sm"
                      >
                        View book →
                      </a>
                    )}
                  </div>

                  {likeErrors[post.id] && <p role="alert" className="mt-2 text-sm text-[#8f2635]">{likeErrors[post.id]}</p>}
                  {expanded && post.contains_spoilers && !revealedSpoilers.includes(post.id) && <p className="mt-4 text-sm text-[#756866]">Reveal this discussion to read its comments.</p>}
                  {expanded && (!post.contains_spoilers || revealedSpoilers.includes(post.id)) && (
                    <div id="comments" aria-labelledby="comments-heading" role="region" className="mt-5 scroll-mt-5 border-t border-[#eee2de] pt-5">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <h2 id="comments-heading" className="aepilog-heading text-2xl font-medium">Comments</h2>
                        <button type="button" onClick={() => { if (composerOpen) setComposerOpen(false); else if (requireAccount()) setComposerOpen(true); }} className="rounded-full border border-[#e6d8d4] px-3 py-2 text-sm font-medium">{composerOpen ? "Cancel comment" : "Add a comment"}</button>
                      </div>
                      {composerOpen && <div className="aepilog-reveal mb-5">
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
                          autoFocus
                          placeholder="Add a comment..."
                          className="w-full resize-none rounded-2xl border border-[#e4d7d2] bg-white px-4 py-3 outline-none focus:border-[#b65a65]"
                        />

                        <ReplyBookPicker open={bookPickers[post.id] || false} onOpenChange={(open) => setBookPickers((current) => ({ ...current, [post.id]: open }))} value={commentBooks[post.id] || null} onChange={(value) => setCommentBooks((current) => ({ ...current, [post.id]: value }))} disabled={postingComment === post.id} />
                        {commentErrors[post.id] && <p role="alert" className="mt-2 text-xs text-[#8f2635]">{commentErrors[post.id]}</p>}
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
                              (!commentDrafts[
                                post.id
                              ]?.trim() && !commentBooks[post.id]) ||
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
                      </div>}

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
          {guestUsername ? <>Posting as <a href="/profile" className="font-semibold text-[#8f2635]">{guestUsername}</a>.</> : <a href="/auth" onClick={() => sessionStorage.setItem("nextchapter_return_after_auth", window.location.href)} className="font-semibold text-[#8f2635]">Sign in to post</a>}
        </div>
      </section>

      {createOpen && (
        <div
          className="aepilog-overlay fixed inset-0 z-50 flex items-center justify-center bg-[#2d2625]/45 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeCreateModal();
            }
          }}
        >
          <div className="aepilog-panel max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[30px] bg-[#fffdf9] shadow-2xl">
            <div className="flex items-start justify-between border-b border-[#eee2de] px-7 py-5">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.14em] text-[#a05a62]">
                  {postType === "poll" ? "Create poll" : "New discussion"}
                </div>

                <h2 className="font-aepilog-serif mt-1 text-2xl font-bold text-[#3a2b2b]">
                  {postType === "poll" ? "Book vs book" : "New discussion"}
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

            <div className="flex gap-2 px-5 pt-4 sm:px-7">{(["post", "poll"] as const).map((type) => <button key={type} type="button" disabled={posting || pollBusy} aria-pressed={postType === type} onClick={() => setPostType(type)} className={`rounded-full px-4 py-2 text-sm font-semibold ${postType === type ? "bg-[#8f2635] text-white" : "border border-[#e6d8d4] text-[#8f2635]"}`}>{type === "post" ? "Discussion" : "Book vs book"}</button>)}</div>
            <div hidden={postType !== "poll"}><BookPollComposer onBusy={setPollBusy} onPosted={(id) => { setCreateOpen(false); setDiscussionText(""); setSelectedBook(null); changeBookQuery(""); setContainsSpoilers(false); setFilter("newest"); router.push(discussionHref(id)); }} /></div>
            <div hidden={postType !== "post"}>
            <div className="space-y-6 p-7">
              <div>
                <label className="mb-2 block text-sm font-bold">
                  Add a book (optional)
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
                      aria-label="Remove attached book"
                      onClick={() => {
                        setSelectedBook(null);
                        changeBookQuery("");
                      }}
                      className="rounded-full bg-white px-3 py-2 text-xs font-bold"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div>
                    <input
                      value={bookQuery}
                      onChange={(event) =>
                        changeBookQuery(event.target.value)
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

                        {bookSearchError && <p role="alert" className="p-4 text-sm text-[#8f2635]">{bookSearchError}</p>}
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
        </div>
      )}

      {rateOpen && (
        <div
          className="aepilog-overlay fixed inset-0 z-50 flex items-center justify-center bg-[#2d2625]/45 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeRateModal();
            }
          }}
        >
          <div className="aepilog-panel flex h-[70dvh] max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[30px] bg-[#fffdf9] shadow-2xl sm:h-auto sm:overflow-y-auto">
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
                  changeBookQuery(event.target.value);
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

                  {bookSearchError && <p role="alert" className="p-4 text-sm text-[#8f2635]">{bookSearchError}</p>}
                  {!searchingBooks && !bookSearchError && bookResults.length === 0 && (
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
