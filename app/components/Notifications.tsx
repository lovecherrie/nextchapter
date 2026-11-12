"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { useReaderViewer } from "./ReaderSocial";

const NotificationsContext = createContext<{ viewer: string | null | undefined; unread: number | null; refresh: () => void }>({ viewer: undefined, unread: null, refresh: () => {} });

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const viewer = useReaderViewer();
  const [count, setCount] = useState<{ user: string; unread: number } | null>(null);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    if (!viewer) return;
    let current = true;
    let busy = false;
    const controller = new AbortController();
    async function load() {
      if (busy || document.visibilityState === "hidden") return;
      busy = true;
      try {
        const { count, error } = await supabase.from("reply_notifications").select("id", { count: "exact", head: true }).eq("recipient_id", viewer!).is("read_at", null).abortSignal(AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]));
        if (current && !error) setCount({ user: viewer!, unread: count ?? 0 });
      } catch { /* Keep the last confirmed count; the inbox has retry UI. */ }
      finally { busy = false; }
    }
    void load();
    const timer = window.setInterval(() => void load(), 60000);
    window.addEventListener("focus", load);
    document.addEventListener("visibilitychange", load);
    return () => { current = false; controller.abort(); window.clearInterval(timer); window.removeEventListener("focus", load); document.removeEventListener("visibilitychange", load); };
  }, [viewer, revision]);
  return <NotificationsContext.Provider value={{ viewer, unread: count && count.user === viewer ? count.unread : null, refresh }}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() { return useContext(NotificationsContext); }

export default function NotificationBell() {
  const { viewer, unread } = useNotifications();
  if (!viewer) return null;
  return <Link href="/notifications" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"} title="Notifications" className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--aepilog-border)] bg-[var(--aepilog-paper)] text-[#665a58] sm:h-10 sm:w-10">
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-5 w-5"><path d="M18 8a6 6 0 0 0-12 0c0 7-2 7-2 9h16c0-2-2-2-2-9ZM10 21h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
    {!!unread && <span aria-hidden="true" className="absolute -right-1 -top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-[var(--aepilog-cherry)] px-1 text-[10px] leading-4" style={{ color: "var(--aepilog-paper)" }}>{unread > 99 ? "99+" : unread}</span>}
  </Link>;
}
