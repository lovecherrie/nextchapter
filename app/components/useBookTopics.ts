"use client";
import { useEffect, useState } from "react";
import { bookTopicKey } from "@/lib/community-browse";
import { fetchJsonWithTimeout } from "@/lib/fetch-json";

type TopicBook = { title: string; author: string | null };
const cache = new Map<string, { until: number; subjects: string[] }>();

export function useBookTopics(books: TopicBook[], enabled: boolean) {
  const requestKey = JSON.stringify([...new Map(books.map((book) => [bookTopicKey(book), { title: book.title, author: book.author }])).values()].sort((a, b) => bookTopicKey(a).localeCompare(bookTopicKey(b))));
  const [topics, setTopics] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let current = true;
    const controller = new AbortController();
    void (async () => {
      setLoading(true); setFailed(false);
      const result: Record<string, string[]> = {};
      const queue: TopicBook[] = JSON.parse(requestKey);
      let index = 0, failures = false;
      await Promise.all(Array.from({ length: Math.min(3, queue.length) }, async () => {
        while (index < queue.length && !controller.signal.aborted) {
          const book = queue[index++], key = bookTopicKey(book);
          const saved = cache.get(key);
          if (saved && saved.until > Date.now()) { result[key] = saved.subjects; continue; }
          try {
            const data = await fetchJsonWithTimeout(`/api/book/details?${new URLSearchParams({ title: book.title, author: book.author || "", topics: "1" })}`, { signal: controller.signal }, 8000);
            if (!Array.isArray(data.categories)) throw new Error("Missing genres");
            const subjects = data.categories.filter((value: unknown): value is string => typeof value === "string");
            result[key] = subjects;
            if (cache.size >= 200) cache.delete(cache.keys().next().value!);
            cache.set(key, { until: Date.now() + 3600000, subjects });
          } catch { if (!controller.signal.aborted) failures = true; }
        }
      }));
      if (current) { setTopics(result); setFailed(failures); setLoading(false); }
    })();
    return () => { current = false; controller.abort(); };
  }, [requestKey, enabled, retry]);
  return { topics, loading, failed, retry: () => setRetry((value) => value + 1) };
}
