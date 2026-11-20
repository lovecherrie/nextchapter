# Security and moderation review

Prepared 18 November 2026; rollout verified 20 November 2026. The owner explicitly approved the wider posting, avatar and permission protections after automatic review requested clearer scope authorization. The tested migration is applied, and the verified lovecheries account is enrolled privately as moderator. Client table grants and RPC access checks passed production readback; publication of the dependent app follows this database gate.

## Implemented and tested

- Patched Next.js to 16.4.6 and compatible transitive runtime dependencies. Removed the unused OpenAI SDK; existing Gemini/OpenRouter integrations remain. The production-only dependency audit reports zero known advisories. The full audit still has seven moderate development-tool advisories; these are not reported as fixed.
- Response headers prevent framing and object embeds, restrict base/form origins, disable unused browser device permissions, avoid cross-origin full-URL referrers, enable no-sniff and HSTS. The CSP intentionally preserves the existing Next.js script-loading behaviour; it is not a strict nonce CSP.
- AI input validation bounds streamed request bodies to 32 KiB, checks expected fields and rejects cross-origin browser submissions. Public catalogue queries have length and request limits. Errors returned to readers do not contain provider/configuration details.
- Shared database AI quota: 20 admitted recommendation requests per minute and 300 per day across instances. Existing model fallback/hedging can make more than one provider call per admitted request; this is a request quota, not a currency-based billing limit. The API fails closed if the shared quota cannot be checked. Local per-client brakes supplement the shared quota and use salted, memory-only address hashes. They are not presented as a persistent distributed per-IP limit.
- Registered-reader write limits also run in database triggers, covering direct Data API calls for posts, edits, comments, reviews, follows, likes, votes, blocks and reading-circle creation/membership/invites/messages. Book creation is bounded and rejects unsupported cover origins. Avatar storage is limited to ten retained objects per account, alongside the existing 1 MiB JPEG bucket restrictions.
- Reporting supports public discussions, comments, reviews and readers. Snapshots are captured by the database. Reports are private to their reporter and the moderator; repeated submissions do not create duplicate open reports. Moderation hides/restores content without deleting it. Hidden discussions also hide their comment threads.
- Blocking removes follows between the two readers and existing reply alerts, hides their public content while signed in, and rejects direct replies/follows/likes/votes across the block. Public content remains readable while signed out. Settings supports unblocking.
- Moderator authority is stored privately by verified account UUID, never editable display names or user metadata. The owner identified `lovecheries` for access. Enrolment is a separate explicit administrative database action after migration success; the migration contains no hardcoded account identifiers.
- Usage records one signed-in visit per reader/day, excludes moderator visits, and exposes only aggregate daily statistics to the moderator. No tracking cookies, book/page histories or email analytics are added. Daily-activity cleanup occurs on later activity; there is no standalone scheduled retention job in this version.

## Operations

After the database migration succeeds and the founder account is enrolled, the private dashboard is available through Settings → Reports and usage. Ordinary readers cannot read reports or call moderation/usage RPCs, even if they know the dashboard URL. The admin route is marked noindex.

Review the report snapshot, which is collapsed because it may contain spoilers. Hide content to remove it from public reads; Restore reverses that decision. Reader reports can be marked reviewed; this version does not automatically ban accounts or send email alerts. No real reports or moderation actions are seeded for tests.

Do not bypass the migration gate by publishing API guards that reference missing RPCs: the AI route deliberately fails closed. Keep the independent dependency/header patch live while resolving a failed database deployment.

## Verification

The saved implementation passed 107 application tests, a disposable PostgreSQL migration/security suite, targeted lint, TypeScript, a production build, and browser fixtures at 390/1440px. Database tests exercise forged admin metadata, private report access, hide/restore, blocking both directions, cross-thread replies, author-name spoofing, write quotas, avatar capacity, daily unique/returning counts and the shared AI quota. Browser checks cover report retries, signed-out login, moderator-only access, block/unblock and menu hit targets. Production test posts/comments/reports/blocks were not created.

## Still requiring provider/dashboard verification

- Supabase production backup schedule, retention and a real data restore have not been verified through the available connector. Local migration tests are not evidence of a working production backup.
- Supabase security advisors report compromised-password protection disabled. Check plan availability and enable it in Auth settings if supported.
- Provider billing caps, signup CAPTCHA and a wider independent penetration test are not configured or certified by this work. These are separate operational controls, not promises made by the application tests.

Before launch, confirm backups in Supabase Database → Backups and test a restore into an isolated project. Never restore over production as a test. Retain the runtime dependency patches and backend safety schema when rolling back presentation changes; do not discard new reports or blocks.
