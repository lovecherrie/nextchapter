"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SiteHeader from "../components/SiteHeader";
import { supabase } from "@/lib/supabase";

type AuthMode = "login" | "signup";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function checkSession() {
      const { data } = await supabase.auth.getUser();
      if (data.user) router.replace("/profile");
    }
    checkSession();
  }, [router]);

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError("");
    setMessage("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanEmail = email.trim();
    const cleanUsername = username.trim();

    setError("");
    setMessage("");

    if (!cleanEmail || !password) {
      setError("Enter your email and password.");
      return;
    }

    if (mode === "signup" && !cleanUsername) {
      setError("Choose a display name.");
      return;
    }

    if (mode === "signup" && cleanUsername.length > 24) {
      setError("Keep your display name to 24 characters or fewer.");
      return;
    }

    if (password.length < 6) {
      setError("Use a password with at least 6 characters.");
      return;
    }

    setSubmitting(true);

    try {
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: { username: cleanUsername },
          },
        });

        if (signUpError) throw signUpError;

        localStorage.setItem("nextchapter_guest_username", cleanUsername);

        if (data.session) {
          router.push("/profile");
          router.refresh();
          return;
        }

        setMessage(
          "Account created. Check your email for the confirmation link, then log in."
        );
        setMode("login");
        setPassword("");
      } else {
        const { data, error: loginError } =
          await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password,
          });

        if (loginError) throw loginError;

        const accountUsername = data.user?.user_metadata?.username;

        if (
          typeof accountUsername === "string" &&
          accountUsername.trim()
        ) {
          localStorage.setItem(
            "nextchapter_guest_username",
            accountUsername.trim()
          );
        }

        router.push("/profile");
        router.refresh();
      }
    } catch (authError: any) {
      console.error("Auth error:", authError);
      setError(
        authError?.message || "Something went wrong. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f2e8] text-stone-900">
      <SiteHeader />

      <div className="mx-auto flex max-w-5xl justify-center px-5 py-10 md:py-16">
        <section className="w-full max-w-md rounded-[32px] border border-stone-200 bg-[#fffdf8] p-6 shadow-sm sm:p-8">
          <div className="text-center">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#8a6f47]">
              NextChapter account
            </div>

            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              {mode === "login" ? "Welcome back" : "Create your account"}
            </h1>

            <p className="mt-2 text-sm leading-6 text-stone-500">
              {mode === "login"
                ? "Log in to keep building your reading profile."
                : "Save your reading life and make your profile yours."}
            </p>
          </div>

          <div className="mt-7 grid grid-cols-2 rounded-2xl border border-stone-200 bg-white p-1">
            <button
              type="button"
              onClick={() => switchMode("login")}
              className={
                mode === "login"
                  ? "rounded-xl bg-[#4f5f45] px-4 py-2.5 text-sm font-semibold text-white"
                  : "rounded-xl px-4 py-2.5 text-sm font-semibold text-stone-500 transition hover:bg-[#eef2ea]"
              }
            >
              Log in
            </button>

            <button
              type="button"
              onClick={() => switchMode("signup")}
              className={
                mode === "signup"
                  ? "rounded-xl bg-[#4f5f45] px-4 py-2.5 text-sm font-semibold text-white"
                  : "rounded-xl px-4 py-2.5 text-sm font-semibold text-stone-500 transition hover:bg-[#eef2ea]"
              }
            >
              Sign up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-6">
            {mode === "signup" && (
              <div>
                <label
                  htmlFor="username"
                  className="text-sm font-semibold text-stone-700"
                >
                  Display name
                </label>

                <input
                  id="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  maxLength={24}
                  autoComplete="nickname"
                  placeholder="Bookworm"
                  className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#aebaa5] focus:ring-2 focus:ring-[#dfe7da]"
                />
              </div>
            )}

            <div className={mode === "signup" ? "mt-4" : ""}>
              <label
                htmlFor="email"
                className="text-sm font-semibold text-stone-700"
              >
                Email
              </label>

              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                placeholder="you@example.com"
                className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#aebaa5] focus:ring-2 focus:ring-[#dfe7da]"
              />
            </div>

            <div className="mt-4">
              <label
                htmlFor="password"
                className="text-sm font-semibold text-stone-700"
              >
                Password
              </label>

              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                placeholder="At least 6 characters"
                className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#aebaa5] focus:ring-2 focus:ring-[#dfe7da]"
              />
            </div>

            {error && (
              <div className="mt-5 rounded-xl border border-[#d6b5ad] bg-[#f8ebe7] px-4 py-3 text-sm text-[#8a4f43]">
                {error}
              </div>
            )}

            {message && (
              <div className="mt-5 rounded-xl border border-[#bdc9b6] bg-[#e7eee2] px-4 py-3 text-sm leading-6 text-[#4f5f45]">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-6 w-full rounded-xl bg-[#4f5f45] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#43513b] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting
                ? mode === "login"
                  ? "Logging in..."
                  : "Creating account..."
                : mode === "login"
                ? "Log in"
                : "Create account"}
            </button>
          </form>

          <p className="mt-5 text-center text-xs leading-5 text-stone-400">
            You can still use book recommendations without an account.
          </p>
        </section>
      </div>
    </main>
  );
}
