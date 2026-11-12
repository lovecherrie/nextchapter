# Aepilog handover

Updated 12 November 2026. Read `AGENTS.md` and the relevant installed Next.js documentation before coding. This document records project context and verified work; confirm the current Git status and deployment before proceeding.

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

All six checked-in migrations have already been applied to production. Do not reapply them blindly:

1. `202611110001_reader_profiles_and_follows.sql`
2. `202611110002_community_write_ownership.sql`
3. `20261111064426_reader_profile_photos.sql`
4. `20261111171827_book_polls_and_reply_books.sql`
5. `20261112033307_public_top_four.sql`
6. `20261112035152_atomic_top_four.sql`

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

- Integrate further approved Figma design changes. Initial brand icons are now installed (see below).
- Finalize broader reading-style/avoid options and a nonfiction-friendly rating redesign with the owner; those decisions were intentionally deferred.
- Continue measuring recommendation latency before selecting a different model or adding paid services. No new paid AI service was authorized by this implementation.

## Fraunces and discussion hierarchy trial (12 November 2026)

The owner requested Fraunces throughout the website, replacing Inter, including buttons, inputs and share-card text. The featured discussion now shows a small poster name, larger discussion text, then a smaller book title; spoiler text and poll choices remain hidden until revealed in the feed. Regular discussion text is slightly larger. Create post is the single entry point, with Discussion and Book vs book options inside. In poll mode the small editor label reads Create poll. The owner requested removal of the separate poll shortcut after trying it. No example posts were added to production. These are a visual trial and can be reverted independently of the poll database migration.

The earlier search-page request is also implemented: Books and People share container width, heading scale and spacing; selected tabs have explicit white text (the global anchor inheritance previously overrode the colour utility). The book heading is Search for books. Search and follow behaviour are preserved.

## Initial brand icons (12 November 2026)

The owner supplied the cherry logo, approved a lowercase `aepilog.` correction, and allowed a simple lowercase `a` at tiny sizes. `public/brand/aepilog-logo.png` is the circular transparent-corner cherry artwork; its lower edge is cherry, with the unwanted cream rim removed. `public/brand/aepilog-mark.png` is a lowercase Fraunces monogram for small icons. Next.js metadata conventions expose `app/favicon.ico` (16/32/48px), `app/icon.png` (96px, a multiple of Google's recommended 48px size), and `app/apple-icon.png` (180px). The root metadata uses the full cherry logo in Open Graph and Twitter summary previews. Google and social platforms control their cached icon/preview refresh timing. The existing header wordmark remains lowercase text. Assets can also be downloaded for social profile use; no social account was changed.

## Interaction motion (12 November 2026)

The owner requested a less stiff interface, especially a fast small-to-large pop when liking. Community and book discussions use `AnimatedLikeButton`: the heart responds immediately to clicks/taps/keyboard activation with a 280ms pop, and a smaller 180ms response on unlike. Existing persistence handlers and confirmed like counts/states are unchanged. Animations cancel cleanly on repeat interaction/unmount, skip existing likes on page load, and respect reduced-motion preferences. No animation dependency was added.

Brief CSS motion adds button press feedback, fine-pointer hover lift, search-tab colour transitions, and entrances for post/rating/share/recommendation panels, comments and filters. All new transforms/entrances are restricted to `prefers-reduced-motion: no-preference`; interactions are never delayed waiting for an animation. No continuous animation or feed-wide entrance was added. The production build and 80 application tests passed. Browser fixtures at 390/1440px with normal/reduced motion checked immediate heart animation, successful like/unlike, failed-save state preservation, panel/tab interactions and layout.

## Profile settings trial (12 November 2026)

At the owner's request, visibility controls moved from the main profile into `/settings`, under Privacy. Profile now has a labelled settings gear beside its edit controls, and View public profile under the bio. Existing own-profile visibility reads/writes and explanatory privacy limits are retained; nothing is saved merely by opening Settings. Signed-out/anonymous visitors get a sign-in link, preserving the settings return destination. Settings is excluded from indexing and the sitemap. The active profile icon is explicitly cream on its burgundy background on mobile and desktop; the matching mobile search icon receives the same colour correction.

The Git tag `profile-before-settings-20261112` preserves commit `b9f7574` before this trial. To undo later, revert the focused settings commit rather than resetting shared main, so subsequent work is preserved. Production build, 80 application tests and new settings ESLint checks passed. Browser fixtures at 390/1440px verified clean profile, public-profile link, gear navigation, owned privacy save/reload, failure preservation, cream SVG stroke and no overflow. Signed-out/anonymous tests confirmed no privacy controls or writes. SiteHeader retains its pre-existing home-anchor lint errors; no new lint issue was introduced. No database migration was required.

## Public shelf, photo menu and faster profile navigation (12 November 2026)

The owner requested a clean avatar: Edit profile photo is now the photo itself, with change/add/remove controls visible only after clicking it. The popover closes outside or on Escape, and retains the existing preview, explicit save, compression and failure handling. Keyboard users can activate the photo button; a successful save/removal closes its controls.

Public reader profiles now show up to four chosen favourites in position order, with covers and links to their books. Settings → Privacy has an independent Show my Top 4 on my public profile toggle, enabled by default as requested. Hiding ratings/discussions does not hide the shelf. Private profiles and readers disabling their shelf are also protected at the database layer. Owners retain access to edit their own Top 4. Want to Read stays private and is never fetched for a public shelf. Migration five adds `show_top_books`, appends it to the invoker reader view and replaces the original unrestricted shelf read policy with the visibility checks. Shelf writes remain registered-owner-only, and clients cannot reassign owners. Existing books and shelves are preserved.

Profile/Settings/header links now use Next.js client navigation and prefetching rather than full-page reloads. A bounded 30-second, account-scoped memory cache reuses the verified account display data, own reader/photo and private profile snapshot for quick returns. It never persists to browser storage or server module state. Logout/account changes clear it; account edits invalidate it; shelf/list/photo/visibility saves update the appropriate snapshot. Visiting book/Community/other sections invalidates the private activity snapshot, so subsequent saves there are refreshed on returning to Profile. Database RLS still validates requests, and cached UI is not an authorization mechanism. Other readers' public profiles are fetched afresh so privacy changes are not served from a shared reader cache. First visits and expired entries still require network requests.

Restore point: `profile-before-public-shelf-20261112` at `6c941ad`. Revert the feature commit to undo the presentation changes; keep the additive migration and privacy checks unless intentionally reviewing a database rollback. The production build, 84 application tests and all disposable database tests passed. Browser fixtures at 390/1440px confirmed hidden photo actions; preview/cancel/save/failure/remove; in-document Profile → Settings → Profile navigation without additional account, profile or photo reads while warm; updated visibility; public shelves independent of activity; and no private Want to Read or horizontal overflow. Production schema/grants and security-advisor checks passed, with only the previously known Auth advisory. No production test users, photos or shelves were created.

## Site audit and loading fixes (12 November 2026)

The owner authorized a bug/performance/layout audit, safe fixes and publishing while away. Restore tag `site-before-audit-20261112` points to `0fe12f7`. Preserve the current design, recommendation providers, search ranking, privacy defaults and existing navigation choices.

- Book discussion loading now uses embedded like/comment counts and a bounded batch of own-like IDs instead of three reads for every post. For 12 posts and a signed-in reader, this portion drops from 38 reads to three (two when signed out); larger own-like batches cap at 100 IDs. Polls involving the book as their second choice remain included. Errors have retry UI rather than silently appearing as an empty discussion list. A ten-second deadline bounds the read chain.
- Client navigation between book identities remounts the book content, preventing the previous book's draft, rating editor and cover state from carrying across. Refreshes use a request version so late discussion responses cannot overwrite a newer load.
- Community post/rating book searches now abort obsolete requests and ignore their late results. Changing text clears old matches immediately; failures are shown distinctly from no matches, and JSON/body reads have a 12-second deadline. Search-provider logic and recommendation prompts were not changed.
- Community/book like operations recover in `finally`, show a retryable inline error, and have ten-second deadlines. Failed saves preserve the old count/state. Book-page confirmed likes update locally instead of reloading every discussion. Existing heart animations remain immediate and independent of saving.
- Top 4 saves now call `save_top_four(uuid[],smallint[])`: an invoker function under existing ownership RLS, registered readers only, locking only the owner's profile and replacing the shelf in one transaction. Duplicate books/positions, invalid slots, missing books and failed insertion leave the prior shelf intact. A 15-second client deadline prevents indefinite saving UI. No live shelf records were edited for testing.

Verification: 89 application tests and the production build passed; all six migrations plus ownership, visibility, photos, polls and atomic-shelf tests passed in disposable PostgreSQL. Browser checks at 390/1440px covered stale/failed searches, like failure/retry, discussion counts/own likes, clean client book navigation, atomic shelf failure/retry and refreshed cached shelves. Reader/follow/privacy, profile-photo/public-shelf/warm-navigation and recommendation cancellation/preservation regressions also passed. A read-only live audit sampled Community, Find Books, book search, readers, Settings, an existing book and an existing public shelf at 320/1440px: no runtime errors, horizontal overflow or broken images were found in those samples. This is not a guarantee of every device/path.

The repository baseline still has pre-existing lint errors (44 errors/34 warnings at the start of this audit); do not claim a clean full-repository lint run. The new discussion loader passes ESLint. Production function checks confirm invoker execution, registered-role grant and no anonymous execution. Security advisors still report only the previously known Auth setting. No new paid service, test account, public post, vote, photo or shelf was created in production.

## Phone screenshot layout corrections (12 November 2026)

The owner supplied annotated iPhone screenshots (`IMG_4695/4697/4698.heic`) and requested the navigation underline at the bottom edge on phone and MacBook, a profile header that scrolls away, a contained Housemaid Want to Read card, lighter reader names/cleaner numeric characters, and discussion dates at the right on the same row as the name.

Header links now stretch to the bottom border instead of leaving the underline above outer padding; header height and text placement are preserved. The shared header scrolls in normal page flow, including Profile and Settings. Do not restore sticky behaviour without the owner's request. Want to Read uses explicit zero-minimum grid tracks and contained cards; on phones the Remove button sits below the text beside the cover, with space reserved so it cannot overlap the title. Desktop retains the horizontal row. Long titles truncate within the card.

Community poster dates now use a right-aligned semantic time element on the name row. Poster names use medium weight, matching the preferred discussion-heading weight. `ReaderDisplayName` preserves Fraunces for the letters and uses a simpler system serif for the digits in names (Georgia/Times fallback), including profile/directory names and bylines. This is the owner's requested exception to the earlier all-Fraunces preference; other text and numeric counters were not replaced.

Restore tag `before-phone-layout-fixes-20261112` preserves `be5d75f`. The production build and 89 application tests passed. Browser geometry checks at 320, 390, 402 (matching screenshot width), 768 and 1440 pixels confirmed underline/border alignment, header scrolling off-screen, Housemaid and long-title card containment, functional Remove buttons, same-row right dates, name weight/numerals, and no horizontal overflow. No database changes were made.

Validation: 80 application tests and production build passed. Browser checks at 320, 390 and 1440 pixels confirmed Fraunces inheritance, discussion-first sizing, spoiler protection, direct poll entry, matching search containers, white selected tabs, working book/reader search and no horizontal overflow. No database changes were required.

## Community browsing update

The owner preferred the previous Community layout. The redesign in `be49f92` was reverted by `d2edfb3`; do not reintroduce its slogan-style copy. Keep labels plain. The original cream/burgundy layout is retained with optional collapsed Filters beside Top/Newest. All discussions show by default, with no onboarding prompts, persisted filter choices, or automatic personalisation.

Optional filters support author text across books, catalogue-based genres, and a separate spoiler-free checkbox. Clear filters restores the full feed. Genre metadata is fetched only after a genre is selected, using a three-request concurrency limit and a bounded one-hour in-memory cache. The topics-only variant of `/api/book/details` combines Google Books categories and Open Library subjects and skips work-description fetching. Missing catalogue genres are acknowledged rather than guessed. Existing book-details responses remain unchanged when `topics=1` is absent. No database migration or AI classification was added.

Browser fixtures at 390px/1440px verified the default full feed, zero automatic genre requests, author/genre/spoiler combinations, sorting while filtered, collapsed controls, clearing, and refresh restoring defaults. Catalogue checks included Book Lovers, Fourth Wing, and No Exit. Future personalised feeds based on Find Books history are explicitly deferred.

## Dedicated discussion pages (12 November 2026)

Discussions now open at `/discussion/[id]` from Community previews/comment counts, the featured discussion, book discussions, and private/public profile activity. New Community posts, book-page posts and book-vs-book polls open their confirmed thread after successful publishing. Community keeps its existing browsing layout and inline poll voting; expanding replies in the feed/book page has been replaced by a dedicated conversation.

`CommunityScreen` shares the existing discussion/reply/poll behaviour between the thin Community route and the new discussion route. Threads load one post with its comments, support nested replies, attached books, own edits/deletes, likes, poll voting and copyable links. The comment editor opens explicitly; failed submissions retain text and attachments. Spoiler posts hide all replies and poll choices until revealed, including replies without their own spoiler flag. Signed-out readers can browse and are sent to login with the discussion return URL before writing. Missing threads have a themed fallback and failed reads have retry UI. Next's streamed not-found boundary may return HTTP 200 with noindex, as documented by the installed version.

Feed requests download comment IDs/dates for counts instead of full reply bodies. A single browser-only public feed snapshot expires after five minutes and restores filters and scroll when returning from a discussion; confirmed thread mutations update it. It is never stored persistently or shared in server state. Reloading starts fresh. Clipboard failure offers a selectable link instead of falsely reporting success. No database migration was needed.

`docs/starter-discussions.md` contains six original, unpublished prompts for owner review. No external posts were copied and no users, public posts or votes were invented. Outside material requires permission or an appropriate reuse basis and clear author/source links; attribution alone is insufficient for copying full threads/reviews.

Restore tag `before-discussion-pages-20261112` preserves `3294b4a`. Production build and 89 application tests passed. Browser fixtures at 390/1440px covered previews, one-post reads, nested replies, attachment saves, comment edit/delete and failure preservation, spoilers, voting/reload, publishing normal posts and polls from Community and normal posts from book pages, idempotent poll retry, profile links, clipboard denial, missing/error states, native/explicit Back with filter/scroll restoration, signed-out login return and no horizontal overflow/runtime errors. New route/helper ESLint checks passed; the moved shared screen retains existing any-type lint errors from Community, so full-repository lint is not claimed clean. All browser writes used fixtures, not production accounts or records.
