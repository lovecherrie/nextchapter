# Community design trial

The pre-redesign version is preserved by Git tag `community-before-redesign-20261111` at commit `4da54ea`, pushed to GitHub. The design trial changes only `app/community/page.tsx` and this note. It does not change the database or stored posts, ratings, comments, or likes.

To undo the trial, revert the commit titled `Refresh Community around short book conversations` and push the resulting commit to `main`. Use a normal revert, not a hard reset or force push. This preserves the other product improvements and gives Vercel a new deployment of the prior design. If subsequent Community changes conflict, review the revert before committing.

The layout replaces the large spotlight/promotion panels with a compact reading-room introduction and a discussion entry card. The feed has smaller book headers, clearer reply actions, and expandable long posts. Existing rating/discussion editors, filters, spoiler controls, likes and reply flows are retained. The old footer claiming profiles were coming later has been corrected.

Validation: production build; isolated browser fixtures at 390px and 1440px for layout/no overflow, creating a discussion, opening the rating entry, likes, viewing replies, long-post expansion/collapse, spoilers and filters. Screenshot fixtures are test data only and are not published as community posts.
