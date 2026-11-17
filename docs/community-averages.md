# Community averages — development only, not approved for production

Branch: codex/community-averages. Do not merge, apply SQL to production, or deploy to rated420ny.com without explicit approval.

## Counting rule

First average each user's saved scores for a listing ID; then average those per-user contributions. Every person has one equally weighted contribution. Existing reviews across brands/formats remain intact. The count is unique reviewers, not raw review rows. Within a format, the same rule applies to that format only.

Example: A saves 100 and 200, contributing 150. B saves 405. Community total = (150 + 405) / 2 = 277.5, displayed as 278 / 420 and “Avg out of 2 user reviews.” Zero scores count as real reviews. PostgreSQL numeric averages remain unrounded; only displayed totals/categories are rounded.

Current review rows are published through the existing public-read policies. This change adds no moderation workflow.

## Proposed migration

supabase/migrations/20261117191511_community_listing_averages.sql is NEW and NOT APPLIED to production. Older recovered/applied migrations must never be rerun.

It adds a stable-ID dispensary catalogue and a dispensary_id foreign key. The one-time legacy mapping uses normalized name/location only to populate that new column; runtime aggregation groups by listing ID. Scores, review IDs, notes, timestamps and photo references are not removed or rewritten by the backfill.

The original dispensary uniqueness index remains; an additional unique (user_id, dispensary_id) index enforces one review per person/listing. A caller-permission trigger supports legacy submissions during rollout. The new frontend sends IDs and updates an existing rating on a repeat dispensary submission.

Strain reviews, their existing uniqueness constraint and the old per-format stats view remain unchanged. New aggregate views provide both all-format and per-format equally weighted scores.

### Privacy and RLS

The public views are security_invoker=true and return listing ID, optional format, user count and averages only. No user IDs, emails, profiles, notes or photo paths are returned.

Because anonymous callers cannot select private dispensary user IDs, two fixed-query SECURITY DEFINER helpers live in the non-exposed community_private schema. They are owned by a NOLOGIN/NOSUPERUSER/NOBYPASSRLS read-only role, rated420_community_reader, which inherits anon's existing public-review policies. It has no write grants. That role is not granted to anon/authenticated. Existing Auth, RLS and storage policies are not altered.

PUBLIC execution is revoked; anon/authenticated may call only these safe projections. Schema USAGE is needed by the invoker views, but does not expose private table columns. community_private must remain absent from PostgREST's exposed schema list. Local tests verify that anonymous private-ID reads and attempts to assume the helper role are denied.

## Updates and UI

Cards show a community total and unique-user count, or “Not yet rated” / “Be the first to rate.” Details show all five category averages. The All formats default and individual format empty-state recovery are retained.

Database views recalculate on reads, without jobs or a stale materialized cache. Saves/deletions refresh UI data; navigation, focus, visibility changes and a 30-second visible-page refresh update other visitors. This is polling, not instantaneous Realtime push.

Catalogue/API requests retain their existing 1,000-row limits. SQL averages include all review rows, but very large catalogues require pagination before those browsing limits are reached. Production-scale performance is not verified.

## Isolated preview

No paid branch/project was created. A branch-creation request was declined before provisioning. Local PostgreSQL 17.6 was run with Docker network mode none and synthetic accounts.

This feature branch's Vercel preview replaces the backend SDK with a labelled UI test double. The generated preview CSP blocks production connections and cross-origin form submissions. Contact/email and real signup/password actions are disabled. The toolbar offers Reviewer A, Reviewer B and a logged-out visitor. Reviews, edits and synthetic photo uploads persist in that browser's localStorage only, not across devices. Reset using “Reset demo data.”

The adapter is not the authoritative database, nor an authentication/security implementation. It demonstrates the UI/counting rule. SQL/RLS tests are separate.

Production builds never include the demo adapter or seed, even if the local-demo flag is set. The static build copies only runtime assets to dist and never executes SQL. The build does not change production until a separately approved merge/deployment.

## Verification and recovery status

Before the development workspace disconnected, these checks passed:
- Five local PostgreSQL tests: zero/one/multiple users, full precision and equal weighting, edits/deletions, duplicate constraints, ownership RLS, legacy dispensary backfill, anonymous/member aggregate parity, private-ID denial and helper-role restrictions.
- Ten existing contact-handler tests.
- Browser checks at 1280px and 390px: zero/one/multiple accounts, rounding/categories, formats, repeat saves, edits/deletions, photo/refresh persistence, both demo accounts, zero-score reviews, no overflow/JS errors and no production backend requests.
- Existing contact UI checks at 1280/390/320px and existing login/logout/refresh CTA regression checks.
- Production-build isolation, JavaScript syntax and diff checks.

The workspace became unavailable before the initial commit. The development environment has now been restored and the exact recovered commit 1c3788b has passed all seven local PostgreSQL tests, ten contact-handler tests, community desktop/mobile tests and existing contact UI checks. Account-session regressions also passed. Five repeatable build-isolation tests now verify production/default builds exclude the adapter, synthetic seed, tests, SQL and private-file canaries, even when local-demo flags are present. The tests also verify unrelated preview branches remain unaffected.

These tests are being committed incrementally to the existing feature branch. The PR remains unmerged pending the owner's review and explicit production migration/deployment approval. Hosted integration limitations below still apply.

Commands (dedicated local Docker container only, no production URLs accepted by SQL harness):

```sh
docker run -d --name rated420-averages-pg --network none -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17.6
node --test tests/community-db.test.mjs tests/contact-handler.test.mjs tests/build-isolation.test.mjs
RATED420_LOCAL_DEMO=1 node scripts/build.mjs
node tests/community.browser.cjs
node tests/auth.browser.cjs
node tests/contact.browser.cjs
node --check app.js
git diff --check
VERCEL_ENV=production node scripts/build.mjs
```

The SQL harness creates and removes a synthetic local database and a local helper role. Use a dedicated container, never a shared or hosted database.

## Production approval gates and unverified items

Review the entire new SQL file, obtain explicit migration approval, verify a current backup and custom-role availability, and review backfill/index locks. Confirm PostgreSQL supports invoker views, the migration role has the required privileges, and community_private is not exposed. Coordinate migration before the new frontend release; deploying the frontend first will cause missing-view errors.

Local tests do not prove hosted Supabase migration permissions, PostgREST cache/settings, real JWT/Auth with the new schema, remote multi-account concurrency, cross-device persistence, production scale, email or Turnstile. These require an explicitly authorized verification phase. No production signups, review writes, uploads, deletes, secrets or policy changes occurred for this task.

Do not reset data or apply a destructive rollback. Existing reviews and storage objects must remain intact. Main and rated420ny.com remain unchanged.

## Verification follow-up

The recovered commit has now been retested in the restored environment. See [community-verification.md](community-verification.md) for the final local results, the resolved test-harness download issue, reproduction commands and remaining hosted-integration limits. Subsequent commits contain tests/documentation only; application runtime and proposed migration remain unchanged. Production approval is still required.
