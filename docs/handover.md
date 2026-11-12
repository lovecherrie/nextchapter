# Aepilog handover

Updated 11 November 2026. Feature implementation deployed successfully from commit `d019768`. Read `AGENTS.md` and the relevant installed Next.js documentation before coding. This document records project context and verified work; confirm the current Git status and deployment before proceeding.

## Project and workflow

- Live website: https://www.aepilog.com. Repository: https://github.com/lovecherrie/nextchapter.
- Next.js App Router, React, TypeScript, Tailwind, Supabase Auth/Postgres/Storage; Vercel deploys GitHub `main`.
- Preserve the cream and burgundy design, mobile header, working book search, and existing rating editor. The owner is designing a logo and experimenting in a separate Figma prototype. Integrate approved design assets into this application.
- The owner has authorized implementing, testing, pushing and deploying these features. Coordinate handovers: one coding tool edits/pushes at a time. Start a feature branch, inspect existing changes, commit focused work, and check deployment success. Never overwrite another tool's uncommitted work or force-push shared history.
- Keep credentials in environment settings. Never commit `.env` files or expose service-role/AI keys. Browser public Supabase configuration is sufficient for client builds; AI keys remain server-side.

## Implemented behaviour

- Search navigation: the magnifier/Search opens Books, with a People tab linking to the existing reader directory; both share search navigation. The separate Community Find readers button was removed.
- Book search ranks original works above colouring/activity/workbook/summary merchandise unless the reader explicitly requests those. Manga and children's fiction remain eligible. An additional parallel author lookup and stronger author-match ranking support author-name searches.
- Book title search: debounced suggestions, exact/partial results, generally applicable typo suggestions, cover fallbacks, short-lived complete-result caching and request deadlines. Preserve the separation between actual matches and spelling suggestions; do not hardcode particular titles.
- Find Books: up to three combined fiction/nonfiction categories, exclusive Anything option, compact preference chips with eight relevant initial choices and More options. All selections reach the prompt. Manga & Graphic Novels is now available immediately before Anything; its prompt supports published manga and recommends an initial volume for a new series. Different interests need not intersect in every recommendation.
- Recommendations use the existing Gemini model and existing `openrouter/free` backup. The backup can compete after three seconds. Both providers now use low reasoning, a 4,096-token output ceiling, full-body timeouts, and cancellation signals. The client displays elapsed time, allows cancellation, limits a request to 75 seconds, retains form choices and preserves existing results on retry failure.
- Public reader search, profiles, following, privacy settings, and ownership-protected ratings/discussions/comments/likes are deployed. Want to Read and email remain private. See `reader-social.md`.
- Profile photos: `/profile` offers preview, save, change and remove. JPG/PNG/WebP input up to 10 MB is re-encoded to a centred 512px JPEG, removing source metadata. Uploads use unique paths, save the profile reference before deleting the old file, and preserve the old photo on failure. The public `reader-avatars` bucket allows only JPEG files up to 1 MB. Writes/removal are restricted to the signed-in owner's UUID folder. Photos are public assets when their URL is known; hiding a reader profile does not make a previously shared asset URL private.
- Reader cards and profiles show photos, with initials on missing/broken images. Community/book bylines batch portrait lookups and use a bounded, short-lived cache.
- Sharing: Share book on a book page or a rated-book entry in `/profile` opens a cream/burgundy card preview. Export is a 1080×1920 PNG. Own rating/display name can be included or hidden; reviews/spoilers are never exported. Download, copy book link, and supported browser file-sharing are available. Posting to Instagram Stories remains a user action.
- Cards are rendered locally in the browser. `/api/share-cover` retrieves only allowlisted Google Books/Open Library image endpoints, rejects redirects, enforces a 2 MB response limit and a short timeout. Missing/unavailable covers use a designed title placeholder.
- Google Search Console verification and sitemap are deployed. The owner verified the www property, submitted the sitemap, successfully ran its live fetch test and requested homepage indexing. Their latest screenshot said the homepage URL was already on Google. Rankings and refresh timing remain Google's decision.

## Supabase migration state

All four checked-in migrations have already been applied to production. Do not reapply them blindly:

1. `202611110001_reader_profiles_and_follows.sql`
2. `202611110002_community_write_ownership.sql`
3. `20261111064426_reader_profile_photos.sql`
4. `20261111171827_book_polls_and_reply_books.sql`

The third migration appends `avatar_path` to the `security_invoker` reader view, adds an own-folder path constraint and creates the photo bucket/policies. The existing account sync trigger preserves the photo path and privacy settings. Production schema/API checks confirmed these changes without creating production test accounts or photos. Supabase's pre-existing disabled leaked-password-protection advisory remains; no new security advisory appeared after the photo migration.

## Verification and known limits

- `npm test`: 80 application tests, including provider fallback/config, upload/save failure ordering, URL allowlisting, oversized cover responses and existing product regressions.
- `npm run test:db`: disposable local PostgreSQL tests for all migrations, reader privacy, activity ownership, avatar paths, cross-account writes, guest restrictions and removal. This command explicitly uses the local Docker socket and never targets production.
- Production build succeeds. New photo/sharing modules pass ESLint with only image-element warnings. The repository has pre-existing lint errors; do not describe the full lint command as clean.
- Isolated Playwright fixtures at 390px and 1440px verified photo preview/cancel, JPEG compression, save/reload, failed upload preservation, replacement cleanup, public profile display, removal, PNG dimensions/download, native-share invocation, copied links, rating opt-out, modal Escape/focus, and no horizontal overflow. Recommendation cancellation/retry/preferences and prior reader/follow/privacy flows also passed browser checks. Mock browser tests do not prove Safari/Instagram-specific behaviour or production authenticated uploads.
- Read-only live browser checks also passed: reader directory/search/profile, signed-out follow login, existing-book sharing, real cover fetch/fallback, mobile preview and 1080×1920 PNG download. No production test posts, ratings, accounts or photos were created.
- AI latency is still variable. Final production checks after the reasoning/output limits took 8.34s, 8.67s (another five), and 7.39s (philosophy/psychology). All returned five distinct books; the second batch had no overlap with the first. An earlier check took 56.80s, so do not promise instant recommendations or claim the free provider's queueing is fixed.

## Book polls and replies

The owner chose book-versus-book polls and book cards in replies. Top remains based on engagement without a weekly window; votes now join likes and replies in that score. The existing Community layout and optional filters are retained. See `book-polls.md` for schema, behaviour, privacy and verification. The application test count is now 80; the disposable database suite includes poll and attachment security tests.

## Deferred work

- Integrate the owner's approved logo/Figma design.
- Finalize broader reading-style/avoid options and a nonfiction-friendly rating redesign with the owner; those decisions were intentionally deferred.
- Continue measuring recommendation latency before selecting a different model or adding paid services. No new paid AI service was authorized by this implementation.

## Fraunces and discussion hierarchy trial (12 November 2026)

The owner requested Fraunces throughout the website, replacing Inter, including buttons, inputs and share-card text. The featured discussion now shows a small poster name, larger discussion text, then a smaller book title; spoiler text and poll choices remain hidden until revealed in the feed. Regular discussion text is slightly larger. Create post is the single entry point, with Discussion and Book vs book options inside. In poll mode the small editor label reads Create poll. The owner requested removal of the separate poll shortcut after trying it. No example posts were added to production. These are a visual trial and can be reverted independently of the poll database migration.

The earlier search-page request is also implemented: Books and People share container width, heading scale and spacing; selected tabs have explicit white text (the global anchor inheritance previously overrode the colour utility). The book heading is Search for books. Search and follow behaviour are preserved.

Validation: 80 application tests and production build passed. Browser checks at 320, 390 and 1440 pixels confirmed Fraunces inheritance, discussion-first sizing, spoiler protection, direct poll entry, matching search containers, white selected tabs, working book/reader search and no horizontal overflow. No database changes were required.

## Community browsing update

The owner preferred the previous Community layout. The redesign in `be49f92` was reverted by `d2edfb3`; do not reintroduce its slogan-style copy. Keep labels plain. The original cream/burgundy layout is retained with optional collapsed Filters beside Top/Newest. All discussions show by default, with no onboarding prompts, persisted filter choices, or automatic personalisation.

Optional filters support author text across books, catalogue-based genres, and a separate spoiler-free checkbox. Clear filters restores the full feed. Genre metadata is fetched only after a genre is selected, using a three-request concurrency limit and a bounded one-hour in-memory cache. The topics-only variant of `/api/book/details` combines Google Books categories and Open Library subjects and skips work-description fetching. Missing catalogue genres are acknowledged rather than guessed. Existing book-details responses remain unchanged when `topics=1` is absent. No database migration or AI classification was added.

Browser fixtures at 390px/1440px verified the default full feed, zero automatic genre requests, author/genre/spoiler combinations, sorting while filtered, collapsed controls, clearing, and refresh restoring defaults. Catalogue checks included Book Lovers, Fourth Wing, and No Exit. Future personalised feeds based on Find Books history are explicitly deferred.
