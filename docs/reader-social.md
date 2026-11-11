# Reader profiles and following

Routes:
- `/readers`: public display-name search, paginated directory, follow/unfollow.
- `/readers/[user_id]`: public bio, existing public ratings/discussions, followers and following.
- `/profile`: account editing and public-profile visibility controls.

The header structure is preserved. Community has a Find readers link, and reader names in community posts/comments and book ratings/discussions link to profiles. Initials are used until profile-picture design is finalized.

## Data and privacy

`reader_profiles` holds only a user ID, display name, bio, visibility choices and timestamps. `reader_follows` holds follow relationships. `reader_cards` is a `security_invoker` view, so its queries honor the caller's row-level security. Email addresses, tokens and Want to Read are never copied or queried by the reader-directory/profile code.

An auth-table trigger synchronizes display name and bio when a registered account is created or edited. Existing registered accounts are copied once; anonymous guest accounts are excluded. Privacy choices are preserved on subsequent account edits.

Profiles start public, with existing public activity shown, as approved by the owner. Hiding a profile removes it from public reads and prevents new follows. Hiding activity on a profile does not unpublish posts and ratings from their existing book/community pages; the settings explain this distinction.

## Migrations

1. `202611110001_reader_profiles_and_follows.sql` adds the two tables, RLS, public view, metadata-sync trigger and registered-reader backfill.
2. `202611110002_community_write_ownership.sql` adds the separately approved ownership guards to legacy community writes. Existing permissive policies cannot override these restrictive checks. Public reading and existing records are preserved. Owner-only discussion update/delete policies also enable the existing editor controls.

Apply schema before deploying the UI. No service-role key is shipped to the browser, and no new environment variables are required.

## Verification

- `npm test`: application regression tests, including query scope, private-list exclusion, follow identity and errors.
- `npm run test:db`: creates a disposable local PostgreSQL container, applies both migrations and tests public/private visibility, account sync, self/duplicate/forged follows, counts, and ownership despite legacy permissive policies. It never connects to production.
- Browser checks use isolated API/account fixtures at phone and desktop widths for directory search, login returns, follow/unfollow persistence, counters, connections, spoilers and visibility controls.

Production checks use read-only schema inspection and public API requests. An additional transactional production write test requested tool confirmation and expired; it was not used as verification. No production test accounts or follow relationships were created.

The existing Supabase advisory for disabled leaked-password protection remains unchanged: [Supabase password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
