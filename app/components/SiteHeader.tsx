"use client";

type SiteHeaderProps = {
  active?: "find" | "community" | "profile";
};

function ProfileIcon({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="h-5 w-5 sm:h-[21px] sm:w-[21px]"
    >
      <circle
        cx="12"
        cy="8"
        r="3.25"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M5.75 19c.7-3.2 3.1-5 6.25-5s5.55 1.8 6.25 5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function SiteHeader({ active }: SiteHeaderProps) {
  const activeClass =
    "rounded-xl bg-[#4f5f45] px-3 py-2 text-xs font-semibold text-white sm:px-4 sm:text-sm";

  const inactiveClass =
    "rounded-xl px-3 py-2 text-xs font-semibold text-stone-600 transition hover:bg-[#eef2ea] hover:text-[#4f5f45] sm:px-4 sm:text-sm";

  const profileClass =
    active === "profile"
      ? "flex h-10 w-10 items-center justify-center rounded-xl bg-[#4f5f45] text-white sm:h-11 sm:w-11"
      : "flex h-10 w-10 items-center justify-center rounded-xl text-[#4f5f45] transition hover:bg-[#eef2ea] sm:h-11 sm:w-11";

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200 bg-[#fffdf8]/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-5 sm:py-4">
        <a href="/" className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#4f5f45] text-sm font-bold text-white sm:h-10 sm:w-10">
            N
          </div>

          <div className="min-w-0">
            <div className="truncate text-lg font-semibold tracking-tight text-stone-900 sm:text-xl">
              NextChapter
            </div>
            <div className="hidden text-[10px] uppercase tracking-[0.18em] text-[#8a6f47] sm:block">
              Find your next story
            </div>
          </div>
        </a>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <nav className="flex items-center gap-1 rounded-2xl border border-stone-200 bg-white p-1">
            <a
              href="/"
              className={active === "find" ? activeClass : inactiveClass}
            >
              Find Books
            </a>

            <a
              href="/community"
              className={active === "community" ? activeClass : inactiveClass}
            >
              Community
            </a>
          </nav>

          <a
            href="/profile"
            aria-label="Profile"
            title="Profile"
            className={profileClass}
          >
            <ProfileIcon active={active === "profile"} />
          </a>
        </div>
      </div>
    </header>
  );
}
