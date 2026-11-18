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

## Branches and deployment isolation

- `main` is the production release branch. `development` starts from main and contains the verified PR #7 history. Create future development feature branches from development and target their PRs there. Preserve `codex/community-averages` and draft PR #7 as the existing release review record.
- Development builds default to synthetic data. Run `node scripts/build.mjs` and serve only `dist/` with a local static server. The generated HTML uses a mock SDK, blocks browser connections and form submissions, and permits scripts only from the same origin. The build removes the real backend endpoint and public key from the demo runtime and rejects leftover hosted Supabase references before emitting output. Use mock providers and a network-isolated PostgreSQL container for tests.
- Only a Vercel production build explicitly associated with `main` emits the production static assets. Development and preview builds use synthetic data even if a non-main branch is mistakenly given a production target. The branch rules in `vercel.json` allow Git deployment from main only for commits that contain this configuration.
- Before pushing development or future feature branches, verify branch exclusions in both connected Vercel projects, **rated420-staging** and **gooooooo**. In each project's **Settings → Environments**, inspect the Production branch mapping without editing it. In **Settings → Build and Deployment → Ignored Build Step**, use **Custom** with `if [ "$VERCEL_ENV" = production ] && [ "$VERCEL_GIT_COMMIT_REF" = main ]; then exit 1; else exit 0; fi`. This permits the normal main production build and cancels other automatic builds on projects configured to release from main. If a project has another intentionally configured production branch or an existing custom command, stop and review that setting before replacing it. Canceled builds can count toward deployment quotas.
- Follow **Branch → Build → Test → Preview → Approve → Release**. Never use the production-connected staging aliases for development. Before any release, verify real backup recovery, repeat read-only preflight, and obtain explicit approval for the exact commit, migration hash and sequence in [the release plan](docs/pr7-release-plan.md). The database verification gate precedes any approved merge to main.

## PR #7: recovery gate open; production approval required

Branch codex/community-averages; draft PR https://github.com/shenendoaht/Rated420/pull/7. Runtime implementation 1c3788b; verification milestone f17d15c; controlled-release preparation adds transaction/legacy-client checks (23 backend/build checks total). Later preparation commits add docs/tests and owner-run backup tooling only; app runtime and proposed SQL remain unchanged. Fetch the latest PR head for approval rather than relying on these abbreviated references.

- Adds unique-reviewer community averages/cards/details, stable dispensary listing IDs, duplicate protection and data refreshes.
- For each listing ID: average each user's saved review scores, then average those per-user contributions equally. Count unique contributors, not raw review rows. Apply the same rule within each format. Existing brand/format reviews remain intact.
- Five categories remain out of 84; totals out of 420. PostgreSQL numeric averages retain precision; round display only. All currently public review rows are treated as published; no moderation workflow is added.
- Display “Avg out of 1 user review” / plural, or “Not yet rated” and “Be the first to rate.” Views recalculate on reads; saves/deletions, navigation/focus/visibility and a 30-second visible-page timer refresh the UI.
- Build: node scripts/build.mjs via vercel.json outputs dist/; never executes SQL. Production excludes test/demo/SQL sources.
- The already deployed PR #7 preview uses labelled synthetic data, a mock SDK, localStorage and production-access restrictions. Its toolbar offers two demo reviewers/visitor. Demo persistence is browser-local, not cross-device. The development branch build rules above apply only to commits that contain them.

## Database status

Production ledger confirms these versions already applied: 20261115232821 (profiles), 20261116002045 (strains/reviews/photos), 20261116004719 (dispensary reviews/avatars), 20261117060216 (created_by index), 20261117064837 (private contact intake). Never replay them or the root-level legacy SQL copies.

**Pending, not applied:** supabase/migrations/20261117191511_community_listing_averages.sql. It creates dispensary IDs/backfill, aggregate views and a restricted private helper role. Existing reviews/images and Auth/RLS/Storage policies are preserved. See [controlled release plan](docs/pr7-release-plan.md) before any production action.

## Development and testing

Protocol: **Branch → Build → Test → Preview → Approve → Release.**

1. Read AGENTS.md, fetch main/PR state and use an isolated feature branch. Push incremental milestones.
2. Use Node, Docker, Playwright/Chromium and curl (or a cached pinned SDK). SQL tests use only a dedicated local container with network mode none; no production URLs are accepted.
3. Follow [verification commands and results](docs/community-verification.md). Core commands:

```sh
node --test tests/community-db.test.mjs tests/contact-handler.test.mjs tests/build-isolation.test.mjs
node scripts/build.mjs
node tests/community.browser.cjs
node tests/auth.browser.cjs
node tests/contact.browser.cjs
node --check app.js
git diff --check
```

Use the existing rated420-averages-pg container or provision the local container as documented in the verification report. Set PLAYWRIGHT_BROWSERS_PATH only for a nondefault browser cache. Build production locally with VERCEL_ENV=production VERCEL_GIT_COMMIT_REF=main node scripts/build.mjs; this does not deploy.

4. Verify exact-head previews/build logs, describe limitations in the PR, and obtain explicit migration/merge/live-deployment approval. Apply only the approved new migration, then deploy the approved frontend after database checks. See the release plan for stop gates and rollback.

## Data and security map

- `auth.users`/`auth.identities` hold accounts; `public.profiles` is owner-scoped. Never publish private profile/account data.
- `public.strains` is a shared catalogue; `strain_reviews` references strain/user IDs, five scores, generated total, notes, timestamps and photo paths. Existing uniqueness is user/strain/normalized brand/format; PR #7 preserves it and weights each user once.
- `dispensary_reviews` currently identifies shops by name/location and has five scores, notes/photo references and ownership policies. PR #7 adds `dispensaries`, stable FK IDs, one review per user/listing and compatible old-client mapping.
- Review reads are public subject to existing column grants; writes require authenticated ownership. Storage buckets are `strain-review-photos`, `dispensary-review-photos`, `member-avatars`; public display URLs do not authorize object management. Upload/delete policies scope paths to the authenticated user.
- `contact_submissions` and intake/notification RPCs are service-role-only, RLS enabled, with no visitor/member access. Server-side validation, Turnstile, rate limits and idempotency protect intake. Keep all provider/service credentials server-side.
- New aggregate invoker views expose listing/count/category/total values only. Private helpers have fixed queries/empty search paths and a restricted NOLOGIN/NOBYPASSRLS owner. Existing policies are not replaced. Historical SQL is documentation, not a deployment action.

## Backup/recovery and handoff

See [owner-run instructions](docs/backup-recovery.md) and [recovery verification report](docs/backup-verification.md). Owner selected their own computer for existing credentials, encrypted exports and recovery keys. Native PG17 full database export includes Auth and managed schemas; Storage bytes are exported separately. No credentials or production archives have been obtained here. No-cost tooling does not create hosted resources or schedule automatic backups.

Eight synthetic recovery/security tests pass, including isolated restore, Auth identities/hash fixtures, policies, object integrity and cross-snapshot mismatch rejection. **Actual production export/restore remains unverified**, including a compatible pinned image for supabase_vault 0.3.2. Production release remains blocked until the owner returns sanitized recovery evidence and approves the latest head. Existing a22841e approval is not approval of later commits. Hosted private-schema exposure was checked read-only (rejected); repeat before release.

Fresh sessions: read [the self-contained handover](docs/CODEX_HANDOVER.md), then refetch current state. Do not treat that handover or the release plan as authorization. Production remains PR #6 at the baseline above; PR #7 has not been merged or applied.

## Known limits and next priorities

- Local tests validate synthetic accounts/RLS and mocked Auth/providers, not hosted JWT/PostgREST integration, remote concurrency, cross-device persistence or production-scale performance. Browsing retains a 1,000-row request cap.
- The aggregate helper is SECURITY DEFINER in a non-exposed schema, owned by a read-only NOLOGIN/NOBYPASSRLS role; public results contain no user IDs. Confirm hosted exposure/privileges before release.
- Contact email receipt was manually confirmed, but one message retains delivery_unconfirmed tracking. Do not resend solely from that flag. Tracking reconciliation is separate future work.
- Real Turnstile may require a human browser. Do not disable it or regenerate keys to bypass an automated-test failure.
- Priorities: owner review of PR #7 and SQL; verify recovery/hosted configuration gates; controlled release and read-only validation after approval; separately plan authorized write tests, pagination/load verification and contact tracking improvements. No unrelated features or paid infrastructure are approved.
