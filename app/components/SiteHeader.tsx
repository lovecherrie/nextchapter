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
    "relative px-1 py-2 text-sm font-medium transition sm:text-[15px]";

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--aepilog-border)] bg-[rgba(255,253,249,0.95)] backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-5 py-5 sm:py-6">
        <a
          href="/"
          className="aepilog-wordmark shrink-0 text-[36px] leading-none text-[var(--aepilog-ink)] transition hover:text-[var(--aepilog-cherry)] sm:text-[42px]"
        >
          aepilog
        </a>

        <div className="flex items-center gap-5 sm:gap-8">
          <nav className="flex items-center gap-5 sm:gap-7">
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

          <div className="h-6 w-px bg-[var(--aepilog-border)]" />

          <a
            href="/profile"
            aria-label="Profile"
            title="Profile"
            className={`flex h-10 w-10 items-center justify-center rounded-full border transition ${
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
