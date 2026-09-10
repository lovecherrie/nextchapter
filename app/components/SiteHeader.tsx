"use client";

type SiteHeaderProps = {
  active?: "find" | "community" | "search" | "profile";
};

function ProfileIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="h-5 w-5"
    >
      <circle
        cx="12"
        cy="8"
        r="3.25"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M5.75 19c.7-3.2 3.1-5 6.25-5s5.55 1.8 6.25 5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function SiteHeader({
  active,
}: SiteHeaderProps) {
  const navClass =
    "relative px-1 py-2 text-center text-[13px] font-medium transition sm:text-left sm:text-[15px]";

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--aepilog-border)] bg-[rgba(255,253,249,0.95)] backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 py-3 sm:flex sm:items-center sm:justify-between sm:gap-6 sm:px-5 sm:py-6">
        <div className="flex items-center justify-between sm:contents">
        <a
          href="/"
          className="aepilog-wordmark shrink-0 text-[31px] leading-none text-[var(--aepilog-ink)] transition hover:text-[var(--aepilog-cherry)] sm:text-[42px]"
        >
          aepilog
        </a>

          <a
            href="/profile"
            aria-label="Profile"
            title="Profile"
            className={`flex h-9 w-9 items-center justify-center rounded-full border transition sm:hidden ${
              active === "profile"
                ? "border-[var(--aepilog-cherry)] bg-[var(--aepilog-cherry)] text-white"
                : "border-[var(--aepilog-border)] bg-[var(--aepilog-paper)] text-[#665a58]"
            }`}
          >
            <ProfileIcon />
          </a>
        </div>

        <div className="mt-3 flex items-center sm:mt-0 sm:gap-8">
          <nav className="grid w-full grid-cols-3 items-center border-t border-[var(--aepilog-border)] pt-2 sm:flex sm:w-auto sm:gap-7 sm:border-0 sm:pt-0">
            <a
              href="/"
              className={`${navClass} ${
                active === "community"
                  ? "text-[var(--aepilog-cherry)] after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-full after:rounded-full after:bg-[var(--aepilog-cherry)]"
                  : "text-[#665a58] hover:text-[var(--aepilog-cherry)]"
              }`}
            >
              Community
            </a>

            <a
              href="/find-books"
              className={`${navClass} ${
                active === "find"
                  ? "text-[var(--aepilog-cherry)] after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-full after:rounded-full after:bg-[var(--aepilog-cherry)]"
                  : "text-[#665a58] hover:text-[var(--aepilog-cherry)]"
              }`}
            >
              Find Books
            </a>

            <a
              href="/search"
              className={`${navClass} ${
                active === "search"
                  ? "text-[var(--aepilog-cherry)] after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-full after:rounded-full after:bg-[var(--aepilog-cherry)]"
                  : "text-[#665a58] hover:text-[var(--aepilog-cherry)]"
              }`}
            >
              Search
            </a>
          </nav>

          <div className="hidden h-6 w-px bg-[var(--aepilog-border)] sm:block" />

          <a
            href="/profile"
            aria-label="Profile"
            title="Profile"
            className={`hidden h-10 w-10 items-center justify-center rounded-full border transition sm:flex ${
              active === "profile"
                ? "border-[var(--aepilog-cherry)] bg-[var(--aepilog-cherry)] text-white"
                : "border-[var(--aepilog-border)] bg-[var(--aepilog-paper)] text-[#665a58] hover:border-[var(--aepilog-cherry-soft)] hover:text-[var(--aepilog-cherry)]"
            }`}
          >
            <ProfileIcon />
          </a>
        </div>
      </div>
    </header>
  );
}
