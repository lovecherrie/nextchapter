import { createClient } from "@supabase/supabase-js";
import { syncAccountCache } from "./account-cache";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL!;

const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey
);

if (typeof window !== "undefined") {
  supabase.auth.onAuthStateChange((event, session) => {
    syncAccountCache(session?.user && !session.user.is_anonymous ? session.user.id : null, event === "USER_UPDATED");
  });
}
