# Community averages verification report

The development environment was restored and the exact recovered commit `1c3788b99ee0d6a375adbebe2a623d8d159e73c5` was tested from a clean worktree. Subsequent milestones add verification tests, documentation and owner-run backup tooling only; runtime files and the proposed migration are unchanged. All milestones are pushed to the existing `codex/community-averages` remote branch.

## Results

- **8 PostgreSQL integration tests passed**, using PostgreSQL 17.6 in the existing network-isolated Docker container. The harness creates fresh synthetic databases and accepts no production connection URL. Checks cover:
  - Full migration transaction rollback removes the added role/objects/column and preserves the original review.
  - Previous-frontend dispensary inserts, reads and location edits remain compatible after migration.
  - Zero/one/multiple reviewers and equal user weighting across brand/format rows.
  - Full-precision total and category averages, with unique-user counts.
  - Exact recalculation after score edits, review deletion, and a user's last review deletion.
  - Duplicate constraints and RLS ownership/impersonation rejection.
  - Legacy backfill preserves IDs, timestamps, all scores, notes and non-null photo references.
  - Same-name dispensaries at different locations retain separate listing-ID averages.
  - Identical visitor/member aggregate results, private user-ID denial, helper-role restrictions and invoker-view settings.
- **10 existing contact-handler tests passed**: validation, Turnstile checks, private receipt, notification handling, duplicate/rate-limit behavior and administrator authorization, all with mocked providers.
- **5 build-isolation tests passed**: production and default builds exclude demo code/data, preview controls, SQL, tests, scripts and private-file canaries. Production ignores local-demo flags. This feature preview is isolated; unrelated preview branches retain their prior behavior.
- **Community browser tests passed at 1280px and 390px**: total/category rendering and rounding, zero/one/multiple users, formats/empty recovery, repeat saves update existing reviews, edits/deletions refresh scores/counts, both demo identities, zero-valued reviews, saved photo decoding after refresh, no overflow/JavaScript errors and no production backend requests.
- **Account browser regression tests passed at 1280px and 390px**, using the real pinned Supabase browser SDK with fully mocked backend requests: logged-out registration navigation, login/session restoration, account identity, authenticated rating navigation, logout and refresh behavior. CTA styling/icon remain unchanged.
- **Existing Contact Us UI tests passed at 1280px, 390px and 320px**: field validation, conditional fields, server/rate/network error recovery, branded success/reference, retry identifiers, navigation, missing configuration and script-load failure handling.
- JavaScript syntax and diff whitespace checks passed.

## Test-harness issue resolved

The default account test initially failed to download the public SDK because this environment refused Node's direct fetch connection. Cached-SDK execution already passed. The harness now downloads only the pinned public SDK through proxy-aware curl (or accepts `AUTH_TEST_SDK_PATH` for an offline copy). Its default path was rerun successfully. This did not require an application, authentication, credential or infrastructure change.

## Reproduction

Requires Node, Docker, Playwright/Chromium and curl (unless supplying the offline SDK path). Do not use a shared database container.

```sh
# Reuse the existing dedicated container, or start it once if absent:
docker run -d --name rated420-averages-pg --network none \
  -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17.6
node --test tests/community-db.test.mjs tests/contact-handler.test.mjs tests/build-isolation.test.mjs
RATED420_LOCAL_DEMO=1 node scripts/build.mjs
node tests/community.browser.cjs
node tests/auth.browser.cjs
node tests/contact.browser.cjs
node --check app.js
node --check preview/client.js
node --check scripts/build.mjs
git diff --check
```

Set `PLAYWRIGHT_BROWSERS_PATH` only if Chromium is installed outside Playwright's default cache. Negative SQL tests intentionally generate caught duplicate/permission/RLS errors; these are expected rejection checks, not failed tests.

## Boundaries and remaining limitations

No production SQL, migrations, user edits, uploads, deletions, credentials, policies or live deployments were performed. No paid infrastructure or Supabase branch was created. PR #7 remains unmerged.

The public preview uses labelled synthetic data and localStorage; it does not prove hosted authentication, cross-device database persistence or real provider behavior. PostgreSQL tests validate database logic/RLS with synthetic auth identities; account tests mock remote Auth. They do not establish real Supabase JWT/Auth/PostgREST integration after migration.

Hosted migration privileges, custom-role availability, PostgREST schema-cache/exposure settings, real multi-account concurrency, production-scale performance and remote Storage/Auth/contact integrations remain outside this local verification. Existing 1,000-row catalogue/API browsing limits remain documented. Other visitors refresh on navigation/focus/visibility and a 30-second visible-page timer, not realtime push.

Before production, separately approve the complete proposed migration and coordinated deployment. Review backup availability, locks/backfill, helper-role permissions and the non-exposed private schema. Never replay historical migrations. The new production frontend must not be released before its approved schema.

## Recovery preparation follow-up

At tool milestone c8361a3, all 23 backend/build checks and desktop/mobile community, account and contact suites were rerun successfully. Eight additional synthetic recovery/security tests pass; see [backup verification](backup-verification.md). This does not pass the actual production recovery gate. Owner-run instructions and the fresh-session handover are linked from DEVELOPMENT.md.
