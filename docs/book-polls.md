# Book polls and book replies

## Reader flow

- Community → Create post → Book vs book: write a question (up to 280 characters), choose two different published books, optionally mark spoilers, and post.
- Readers can view results without voting. Registered readers have one vote per poll and may change it. Vote identity is private; totals are public.
- Poll questions and choices are fixed after posting. The author can edit the spoiler setting or delete the post using its existing menu.
- Comments and nested replies on Community have an optional Attach a book control. A book can be sent with or without additional text. Reply cards link to the book and allow saving to the signed-in reader's private Want to Read list.
- Attached books render on existing book-page discussion threads too. Polls are discoverable from either book's discussion page, with a link to the full poll on Community.
- Poll options and attached-book cards respect their enclosing spoiler controls. A spoiler poll's featured preview hides its question and book choices until the reader opens it.
- Top retains an all-time engagement score: likes + twice the number of comments + poll votes. There is no weekly reset. The existing layout and optional browsing filters are preserved; author/genre filters consider either book in a poll.

## Storage and integrity

Migration: `20261111171827_book_polls_and_reply_books.sql` has been applied to production. Do not apply it again. Production checks confirmed RLS, private ballots, public totals, immutable client vote identity/counts, inaccessible internal trigger functions, and working public post/poll/reply relationships. No production test polls, votes, or replies were created. The security advisor returned only the pre-existing leaked-password-protection warning.

`comments.recommended_book_id` is an optional book reference. Existing comment ownership policies apply; existing comments default to no attachment.

`book_polls` stores two book IDs and public aggregate totals. Only owned discussion posts can be used when inserting a poll. Clients cannot update counts or choices. `book_poll_votes` stores the signed-in reader's choice with a `(poll_id,user_id)` primary key. RLS allows reading/writing only one's own ballot and excludes anonymous guest writes.

The public RPCs `create_book_poll` and `cast_book_vote` use SECURITY INVOKER and are executable only by authenticated readers. Creation inserts the post and poll in one transaction. A client request UUID makes retries idempotent. Vote changes use an upsert on the existing ballot.

A revoked, non-exposed trigger function in `aepilog_private` maintains counts atomically. It validates the acting identity for vote creation/update, prevents moving a ballot between identities/polls, and handles deletions including account/poll cascades. Another private SECURITY INVOKER trigger locks poll questions/book associations while allowing spoiler/name updates. No service-role credentials are sent to clients.

## Checks

- `npm test`: poll relationship parsing, rounded vote percentages, engagement scoring and existing application tests.
- `npm run test:db`: all migrations in a disposable local PostgreSQL container; one vote/reader, vote changes, private ballots/public totals, count spoofing, anonymous restrictions, idempotent creation, failed-create rollback, question locking, attachment ownership, and deletion cascades.
- Isolated browser fixtures cover 390px/1440px flows, signed-out results/login, spoof-safe save identity, vote failures, creation retries/draft preservation, book-only/nested replies, Want to Read, spoiler protection and persistence. Additional 320px checks cover card sizing, either-book author filtering and book-page rendering.

Production verification should inspect schema/security and use read-only API/browser requests. Do not create fake public polls or replies for testing. To roll back the UI, revert its feature commit while retaining the additive schema and user-created content; do not drop ballot or reply data.
