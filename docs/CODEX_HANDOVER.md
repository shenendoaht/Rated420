# Fresh Codex session handover

Use the prompt below with a fresh session. This is context, **not permission to modify production**. Repository documentation is the durable source of detail; refetch service state before any release.

---

Continue Rated420 NY development and gated PR #7 release preparation. Preserve all existing design, behavior, accounts, reviews, scores, images, Auth/RLS/Storage protections and credentials. Do not add unrelated features or costs.

## State and repository

- GitHub: https://github.com/shenendoaht/Rated420 ; draft PR #7: https://github.com/shenendoaht/Rated420/pull/7 . Feature remote branch: `codex/community-averages`. **Not merged.**
- Recovered runtime implementation: `1c3788b99ee0d6a375adbebe2a623d8d159e73c5`; original verification milestone `f17d15c`; release-plan milestone `a22841e`; owner export tools `e69e204`; tested local recovery verifier milestone **c8361a30211ae608927bc3ac52fabc500433419c**. Final documentation milestones follow it. Fetch and record the complete current remote SHA using `git rev-parse origin/codex/community-averages`; the owner's final report supplies the handoff head. Never assume a later head has been approved.
- Last active workspace: `/workspace/work/rated420-verification`, local branch `codex/community-verification`, pushed as `HEAD:codex/community-averages`. It is authoritative. The older `/workspace/work/rated420-averages` worktree is on a stale local branch with uncommitted recovered implementation; other historical contact/format worktrees also exist. Inspect first; never reset, overwrite or commit their unrelated work.
- Production/main remains **483b6d16d45f12d2c8aae1f056348e7f2aa80f24** (PR #6), Vercel **dpl_HENB6pUySfADX7NT8XuZbzQFZDiW**, READY. PR #7 schema/frontend are **not live**. No production migration, merge or deployment was performed during recovery preparation.

## Required protocol and authorization

**Branch → Build → Test → Preview → Approve → Release.** Use isolated feature branches/PRs and commit/push incremental tested milestones. Read AGENTS.md and DEVELOPMENT.md before acting. Explicit approval is required for production migrations/data changes, merge/live release, security/config changes and any extra infrastructure cost. No live write tests, destructive SQL, historical replay, database resets/history repairs, policy/key/password changes or production restores without specific approval. Never put SQL execution in build/CI/deploy hooks. Prefer direct integrations to browser automation; no TinyFish is needed for the current handoff.

The owner previously approved a gated release of a22841e, but recovery failed its pre-migration gate and execution stopped. Subsequent instructions require production unchanged. That approval is **not authorization for the current later head**. Complete recovery evidence and ask for renewed explicit approval identifying the latest head and migration hash. Do not infer approval from these documents.

## Architecture and integrations

Static framework-free `index.html`, `app.js`, `styles.css`, `contact.js`. Node `scripts/build.mjs` uses a whitelist to create `dist`; `vercel.json` runs it. No package/application framework or automatic database migration step.

Vercel project **rated420-staging** (`prj_C8zzhVqxWD63IhEFulADeDMAYAto`, team `team_8KJM9zcWrJGvRkEVCib0QCEN`) serves https://rated420ny.com . www redirects to apex. **main automatically deploys to production**, so pushing/merging main is a live release. Existing rated420-staging aliases share production/backend and are not isolated staging. Former project rated420 is named gooooooo and can also generate previews; do not change it. Hover hosts DNS; rated420ny.store is reserved/untouched.

Supabase **ymluyoqkmzxomjokjmkj**, Free plan, PostgreSQL **17.11.0.019**, last reported ACTIVE_HEALTHY. Auth accounts/identities; owner-scoped profiles; shared strains catalogue; public review reads/owner-only writes; five scores /84 and total /420; photo paths backed by `strain-review-photos`, `dispensary-review-photos`, `member-avatars`. Review management/photo policies remain unchanged. Private `contact_submissions` and service-only RPCs are inaccessible to visitors/members.

Contact uses Supabase `submit-contact` Edge Function, Cloudflare Turnstile, Resend sender `contact@mail.rated420ny.com`, recipient `rated420.ny@gmail.com`, validated visitor email Reply-To. Existing secrets stay in Supabase; never recreate them or put values in chat/Git/frontend. Read-only readiness endpoint `/functions/v1/submit-contact/config` last returned ready:true. Real human Turnstile and Gmail receipt were previously owner-confirmed; current regressions mock providers, not new live mail.

Existing live features include accounts/profiles, authenticated homepage CTA, reviews/photos, Contact Us and All formats default/format empty-state recovery. Preserve the Lemon OG Haze pre-roll review and all other records. Do not expose real user records in documentation.

## Pending PR #7

Community total/category averages group by listing ID. First average each user's saved reviews for a listing, then average those user contributions equally; count unique users. Same rule within a format. Full DB numeric precision, whole-number display. Existing strain brand/format review uniqueness and save/update semantics remain. New stable dispensary catalogue IDs/FK/backfill and unique user/listing rating protection. No moderation workflow; existing publicly readable rows count as published.

Public invoker aggregate views expose listing IDs/counts/averages only. Private fixed-query helpers use empty search paths and read-only NOLOGIN/NOBYPASSRLS role inheriting the existing anon read policies; no raw private user-ID grants to visitors. Read-time SQL aggregation; UI refreshes after writes/deletes, navigation/focus/visibility and every 30 seconds while visible. Not Realtime push.

Only proposed production SQL:
`supabase/migrations/20261117191511_community_listing_averages.sql`
SHA-256 **8d419be1862dbb1ba6e1ba2457aa69057374484cdaa0d37efce05f5c568a628a**.
It is **not applied**. Historical ledger versions already applied: 20261115232821, 20261116002045, 20261116004719, 20261117060216, 20261117064837. Never replay those or root-level historical SQL.

Feature preview: https://rated420-staging-git-codex-communi-eead09-shenendoahts-projects.vercel.app/ . This exact branch's preview uses labelled synthetic seed/mock SDK and two demo reviewers/visitor; persistence is localStorage only. CSP blocks production network/form access. Production builds ignore demo flags and exclude the synthetic adapter/seed/controls, scripts/docs/SQL/tests. Other preview branches may use production backend; inspect before testing. Preview may require existing Vercel sign-in. Tool milestone preview dpl_Bohe4FqeV8dgHYUvm6JMeDizyJEk was READY/HTTP200; refetch final documentation-head preview/status.

## Backup/recovery: immediate blocker

**Owner selected running credentialed backups on their own computer.** No production credential, database archive or object download was acquired in development. Never ask them to paste secrets or upload production backups.

Read `docs/backup-recovery.md`: Python native PG17 read-only full custom dump (including Auth/managed schemas), encrypted roles/manifest, separate all-bucket Storage export via read-only APIs. GPG verified full fingerprint; private files 0600/directories 0700, outside Git; verified TLS, read-only session options, credentials never argv. No schema/owner/ACL omissions, silent-error skips or output overwrite. Owner keeps at least two encrypted copies and separate key recovery on existing secure storage; no new paid service/schedule.

`verify_database_local.py` accepts only a dedicated empty **local Docker** container, network none/no ports/no privileged/host bind access, and no remote database URL. It decrypts into private encrypted/RAM scratch, verifies digests, creates a random fresh DB, restores three phases with transactions/stop-on-error, compares all inventoried table rows/fingerprints/owners/RLS/ACL/policies/extension versions, verifies Storage bytes and bucket/object IDs/size/metadata/update-time consistency, then drops only its new local DB. LOGIN disabled locally; disposable roles/container require owner cleanup. Native role login passwords/settings and full hosted Auth/Storage/Vault/provider operation are not validated. This is logical data recovery, not PITR or an authorized production restore.

**8 synthetic recovery/security tests pass**, but production recovery gate is **NOT PASSED**. Actual owner-run dump/restore, managed-schema privileges and compatible pinned Supabase PostgreSQL image must still be verified. Production has `supabase_vault` **0.3.2**, pg_stat_statements 1.11, pgcrypto 1.3, uuid-ossp 1.1, plpgsql 1.0. Plain postgres:17.6 fixture image cannot restore all source extensions. Do not skip extensions/schemas to make it pass; select/review a compatible image and stop on errors. Request only sanitized status/counts/tool/image versions/times and confirmation of second copy/key accessibility. A full local service-stack test and existing encryption/provider secrets would be separately needed for application-level disaster recovery.

## Tests and reproduction

Node24, Python3/GPG/Git/Docker and Playwright/Chromium were available in the previous workspace. No project package.json; browser harness requires Playwright in Node's module resolution. Existing fixture container `rated420-averages-pg` uses postgres:17.6, network none. If absent, create a dedicated synthetic container with no ports/binds; never point tests to production. Browser cache was `/tmp/rated420-playwright`; set PLAYWRIGHT_BROWSERS_PATH only if appropriate. Auth harness fetches pinned Supabase SDK 2.117.1 with curl, or accepts AUTH_TEST_SDK_PATH.

```sh
node --test tests/community-db.test.mjs tests/contact-handler.test.mjs tests/build-isolation.test.mjs
python3 -m unittest discover -s tests -p test_backup_recovery.py -v
RATED420_LOCAL_DEMO=1 node scripts/build.mjs
node tests/community.browser.cjs
node tests/auth.browser.cjs
node tests/contact.browser.cjs
VERCEL_ENV=production node scripts/build.mjs
node --check app.js
python3 -m py_compile scripts/backup/*.py tests/test_backup_recovery.py
git diff --check
```

Last rerun: 23/23 backend/build checks (8 SQL/10 contact/5 isolation), 8/8 recovery tests, community/account at 1280/390, contact at 1280/390/320 all pass. Tests cover equal user weighting/categories/unique counts/zero-one-many/edit-delete/duplicates/RLS/rollback/old-client compatibility/photo persistence/login-logout-refresh/errors. Synthetic/mocked tests do not prove hosted JWT/PostgREST cache, remote multi-account concurrency, live writes, real-provider delivery or production load. No production write testing is approved. Runtime/SQL unchanged since recovered commit.

## Release gates, rollback and outstanding work

1. First inspect/fetch remote head and unfinished work; preserve older worktrees. Read owner-run backup evidence and resolve actual recovery/image issues without changing production.
2. Repeat read-only preflight/exposure/ledger/privilege/duplicate/data-preservation checks. Earlier public REST worked and community_private rejected with 406 PGRST106; repeat at release. Whole hosted role/cache path remains unproven before migration.
3. Present exact latest head, SQL hash, preview/results/limits for explicit owner approval. No production actions until approved.
4. Follow `docs/pr7-release-plan.md`: confirm atomic runner/ledger semantics, apply only approved migration with bounded timeouts, verify data/security/independent averages/public REST **before merge**, then approved merge/normal Vercel Git release and read-only desktop/mobile validation. Stop on drift/history/permissions/errors. Never bulk-push historical migrations.
5. Before SQL commit, transactional rollback only through confirmed runner. After SQL commit, keep compatible expanded schema/data; use frontend-only baseline rollback only if explicitly authorized. No automatic database snapshot restore/drop/history deletion. Record new baseline after a successful authorized release via reviewed documentation changes.

Known limits: inherited 1,000-row catalogue/API cap, 30-second polling, no hosted concurrency/load validation. One earlier owner-confirmed delivered contact message retains delivery_unconfirmed/failed tracking without email_id; never resend solely from that status. Tracking reconciliation and pagination are separate future work. Existing secrets and production records must stay unchanged.

Read these durable documents: AGENTS.md; DEVELOPMENT.md; docs/backup-recovery.md; docs/backup-verification.md; docs/pr7-release-plan.md; docs/community-verification.md; docs/community-averages.md. Keep them current, concise and factual. Finish each milestone with tested commit/preview/current production status and remaining blockers. Stop for owner recovery evidence and renewed release approval rather than claiming production release completion.
