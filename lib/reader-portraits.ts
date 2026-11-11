import { supabase } from "@/lib/supabase";

// Batch bylines mounted together instead of making a request for every post.
type Entry = { path: string | null; until: number };
const cache = new Map<string, Entry>();
const pending = new Map<string, ((path: string | null) => void)[]>();
let scheduled = false;

export function rememberReaderPhoto(userId: string, path: string | null) {
  if (cache.size >= 200) cache.delete(cache.keys().next().value!);
  cache.set(userId, { path, until: Date.now() + 60000 });
}

export function readerPortrait(userId: string): Promise<string | null> {
  const cached = cache.get(userId);
  if (cached && cached.until > Date.now()) return Promise.resolve(cached.path);
  return new Promise((resolve) => {
    pending.set(userId, [...(pending.get(userId) || []), resolve]);
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => {
      const batch = new Map(pending); pending.clear(); scheduled = false;
      const ids = [...batch.keys()];
      for (let i = 0; i < ids.length; i += 50) {
        const group = ids.slice(i, i + 50);
        void (async () => {
          try {
            const { data, error } = await supabase.from("reader_cards").select("user_id,avatar_path").in("user_id", group).abortSignal(AbortSignal.timeout(5000));
            if (error) throw error;
            const paths = new Map((data || []).map((row) => [row.user_id, row.avatar_path || null]));
            for (const id of group) {
              const path = paths.get(id) || null; rememberReaderPhoto(id, path);
              for (const done of batch.get(id) || []) done(path);
            }
          } catch { for (const id of group) for (const done of batch.get(id) || []) done(null); }
        })();
      }
    }, 0);
  });
}
