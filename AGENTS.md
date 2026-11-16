# Rated420 development workflow

These instructions apply to the entire repository and to every contributor or coding agent.

## Preserve existing behavior and design

- Preserve existing functionality, visual design, content, accessibility, and responsive behavior unless the user explicitly requests a change.
- Keep changes scoped to the approved task. Report potential breaking changes or security concerns before implementation; obtain explicit direction before proceeding with affected work.
- Do not introduce unrelated refactors, dependency upgrades, configuration changes, or database changes.

## Branches, pull requests, and approval

- Start each task from the current `main` branch and create a new feature branch. Never develop directly on `main`.
- Submit changes through a pull request. Describe the problem, resulting behavior, validation performed, and any risks or limitations.
- Do not merge automatically. Merge only after explicit user authorization, and confirm that the PR still matches the reviewed commit. Changes after review require renewed review.
- Preserve historical files and existing user data.

## Supabase safety

- Never execute live migrations, destructive SQL, or any operation that modifies existing Supabase data without explicit user authorization covering the operation and target project.
- Destructive operations include `DROP`, `DELETE`, `TRUNCATE`, unrestricted `UPDATE`, database resets, and migration-history repairs. A rollback plan or an eventual `ROLLBACK` is not a substitute for authorization.
- Authorization to edit code, open a PR, or deploy the static site does not authorize database changes.
- Default to read-only auditing. Use isolated local fixtures or mocks for write tests. Do not run signup, review submissions, profile changes, uploads, deletions, or automated write tests against the connected backend without explicit authorization.
- The app currently references Supabase project `ymluyoqkmzxomjokjmkj`. Verify the actual target before any database or storage operation.
- Recovered files in `supabase/migrations/` document changes already applied to that existing project. Never automatically or manually rerun them against it.
- Root-level dated SQL files are legacy reference copies, not additional migrations to apply.
- Never add a migration command to application startup, install/build scripts, CI, or Vercel deployment hooks without separate explicit authorization.
- See `supabase/README.md` and `docs/backend-audit.md`. The declined batch in `docs/declined-verification.sql.txt` is an inspection artifact, not an approved test or migration.

## Credentials and user privacy

- Never commit credentials, secret/service-role keys, database passwords, access tokens, private keys, session cookies, authentication state, or sensitive user data.
- Inspect diffs and generated artifacts before committing. Redact logs and reports; do not copy live user records into fixtures.
- Supabase project URLs and browser publishable keys are public client configuration, not privileged credentials. Their presence does not authorize changes to backend access policies.
- If a secret or security issue is discovered, report it before implementing a remedy. Do not repeat secret values in chat, PRs, logs, or commits.

## Validation before proposing a merge

- Run available checks appropriate to the change and report exact results. Never claim tests passed if they were skipped, declined, blocked, or not available.
- This repository currently serves static HTML, CSS, JavaScript, and images; it has no package build script or automated test suite. At minimum, check JavaScript syntax with `node --check app.js`, run `git diff --check`, and verify referenced local assets exist.
- For application changes, test the affected interactions and relevant desktop/mobile layouts. Use mocks or an isolated test backend for write flows unless live testing is explicitly authorized.
- For documentation-only changes, verify wording, links, and scope, and confirm runtime files are unchanged.
- Verify the Vercel preview for the exact PR head commit before proposing a merge: inspect deployment status and build logs, then exercise the affected flow where applicable.
- Block unintended backend writes during browser tests. A preview URL does not guarantee backend isolation.
- Clearly disclose untested authentication, email recovery, review, profile, or storage flows.

## Vercel staging and production

- Existing connected project names include `rated420-staging` and `rated420`. Verify project settings and deployment metadata rather than inferring environment or release behavior from a name.
- The confirmed staging URL is `https://rated420-staging.vercel.app`. The last verified merge to `main` automatically deployed this project and assigned that URL.
- Vercel labels the primary deployment of the staging project as target `production`; that label does not make it the business's production site.
- Feature-branch pushes have produced previews for both projects. Inspect both when applicable. The `rated420` project's production-branch behavior and canonical production domain must be confirmed before any production release.
- Keep staging/production project names, branch mappings, domains, backend targets, and deployment behavior clearly documented when verified or changed. Mark unknown mappings explicitly.
- Current deployment is static and does not run SQL. Preserve that separation.
- Do not change domains, project settings, branch mappings, deployment protection, or release targets outside the user's explicit scope.
- After an authorized merge or release, verify the resulting deployment's commit, status, build logs, and intended domain. Report the final commit and deployment status.
