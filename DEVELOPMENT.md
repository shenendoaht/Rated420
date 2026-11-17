# Rated420 NY development

Last verified: November 17, 2026. Refetch GitHub/Vercel/Supabase status before release; this document is not authorization.

## Architecture and environments

| Component | Current implementation |
| --- | --- |
| Repository | shenendoaht/Rated420; static index.html, app.js, styles.css and contact.js; no framework; Node build/test scripts |
| Production | https://rated420ny.com; www redirects to apex; existing Vercel project **rated420-staging**, ID prj_C8zzhVqxWD63IhEFulADeDMAYAto |
| Deployment mapping | main auto-deploys to that project's Vercel production target. rated420-staging.vercel.app shares the same deployment/backend; it is **not isolated staging** |
| Other project | Former rated420 project is named gooooooo; feature pushes can also generate previews there. Do not infer or change its release target |
| Backend | Supabase project ymluyoqkmzxomjokjmkj: Auth, private member profiles, PostgreSQL review tables/RLS, review-photo/avatars Storage |
| Contact | Private contact_submissions + submit-contact Edge Function; Cloudflare Turnstile; Resend sender contact@mail.rated420ny.com, recipient rated420.ny@gmail.com, validated visitor Reply-To; secrets remain server-side |
| Domains | Hover DNS; Vercel HTTPS; rated420ny.store reserved and unchanged |

Production baseline: **483b6d16d45f12d2c8aae1f056348e7f2aa80f24** (PR #6), Vercel READY. Accounts/profiles, strain/dispensary review forms, photo uploads and Contact Us are live. The homepage CTA reflects authentication; strain review display defaults to All formats with empty-format recovery.

## PR #7: pending production approval

Branch codex/community-averages; draft PR https://github.com/shenendoaht/Rated420/pull/7. Runtime implementation 1c3788b; verification milestone f17d15c; controlled-release preparation adds transaction/legacy-client checks (23 backend/build checks total). Later preparation commits contain docs/tests only. Fetch the latest PR head for approval rather than relying on these abbreviated references.

- Adds unique-reviewer community averages/cards/details, stable dispensary listing IDs, duplicate protection and data refreshes.
- For each listing ID: average each user's saved review scores, then average those per-user contributions equally. Count unique contributors, not raw review rows. Apply the same rule within each format. Existing brand/format reviews remain intact.
- Five categories remain out of 84; totals out of 420. PostgreSQL numeric averages retain precision; round display only. All currently public review rows are treated as published; no moderation workflow is added.
- Display “Avg out of 1 user review” / plural, or “Not yet rated” and “Be the first to rate.” Views recalculate on reads; saves/deletions, navigation/focus/visibility and a 30-second visible-page timer refresh the UI.
- Build: node scripts/build.mjs via vercel.json outputs dist/; never executes SQL. Production excludes test/demo/SQL sources.
- This feature branch's Vercel preview uses labelled synthetic data, a mock SDK, localStorage and production-access restrictions. Its toolbar offers two demo reviewers/visitor. Demo persistence is browser-local, not cross-device. Other preview branches retain their prior backend behavior; inspect their mappings before any write test.

## Database status

Production ledger confirms these versions already applied: 20261115232821 (profiles), 20261116002045 (strains/reviews/photos), 20261116004719 (dispensary reviews/avatars), 20261117060216 (created_by index), 20261117064837 (private contact intake). Never replay them or the root-level legacy SQL copies.

**Pending, not applied:** supabase/migrations/20261117191511_community_listing_averages.sql. It creates dispensary IDs/backfill, aggregate views and a restricted private helper role. Existing reviews/images and Auth/RLS/Storage policies are preserved. See [controlled release plan](docs/pr7-release-plan.md) before any production action.

## Development and testing

1. Read AGENTS.md, fetch main/PR state and use an isolated feature branch. Push incremental milestones.
2. Use Node, Docker, Playwright/Chromium and curl (or a cached pinned SDK). SQL tests use only a dedicated local container with network mode none; no production URLs are accepted.
3. Follow [verification commands and results](docs/community-verification.md). Core commands:

```sh
node --test tests/community-db.test.mjs tests/contact-handler.test.mjs tests/build-isolation.test.mjs
RATED420_LOCAL_DEMO=1 node scripts/build.mjs
node tests/community.browser.cjs
node tests/auth.browser.cjs
node tests/contact.browser.cjs
node --check app.js
git diff --check
```

Use the existing rated420-averages-pg container or provision the local container as documented in the verification report. Set PLAYWRIGHT_BROWSERS_PATH only for a nondefault browser cache. Build production locally with VERCEL_ENV=production node scripts/build.mjs; this does not deploy.

4. Verify exact-head previews/build logs, describe limitations in the PR, and obtain explicit migration/merge/live-deployment approval. Apply only the approved new migration, then deploy the approved frontend after database checks. See the release plan for stop gates and rollback.

## Known limits and next priorities

- Local tests validate synthetic accounts/RLS and mocked Auth/providers, not hosted JWT/PostgREST integration, remote concurrency, cross-device persistence or production-scale performance. Browsing retains a 1,000-row request cap.
- The aggregate helper is SECURITY DEFINER in a non-exposed schema, owned by a read-only NOLOGIN/NOBYPASSRLS role; public results contain no user IDs. Confirm hosted exposure/privileges before release.
- Contact email receipt was manually confirmed, but one message retains delivery_unconfirmed tracking. Do not resend solely from that flag. Tracking reconciliation is separate future work.
- Real Turnstile may require a human browser. Do not disable it or regenerate keys to bypass an automated-test failure.
- Priorities: owner review of PR #7 and SQL; verify recovery/hosted configuration gates; controlled release and read-only validation after approval; separately plan authorized write tests, pagination/load verification and contact tracking improvements. No unrelated features or paid infrastructure are approved.
