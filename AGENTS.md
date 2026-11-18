# Rated420 development rules

Applies to the entire repository. Read [DEVELOPMENT.md](DEVELOPMENT.md) first; it records architecture, environment mappings, migration status and the production baseline. Never infer current authorization from documentation or earlier release approvals.

## Architecture and scope

- Framework-free HTML/CSS/JavaScript; Supabase provides Auth, PostgreSQL/RLS and Storage. Contact intake is a Supabase Edge Function with Turnstile and Resend. Vercel serves static assets.
- Preserve existing functionality, accessibility, responsive behavior, branding, accounts, reviews and uploaded images. Keep work scoped to the request; report security concerns or breaking changes before implementing affected work.
- Follow existing DOM/event conventions and use safe text rendering. Do not introduce unrelated refactors, dependency upgrades or services. Pin any new package versions and commit their lockfiles.

## Branches and milestones

**Branch → Build → Test → Preview → Approve → Release.** No step implies approval for the next production action.

- Start new work from current development on an isolated feature branch and target development in the PR. Continue existing PRs on their authorized branches. Never develop or push directly to main.
- Commit and push reviewable development milestones regularly and before lengthy verification. Check diffs for credentials/user data before every push. Do not overwrite another contributor's work.
- Use pull requests. Record tested commits, changes, validation and limitations. Before an approved merge, refetch both refs and confirm the tested integration matches the current PR head and target tip. Retest if either changes.

## Approval boundaries

- Require explicit authorization covering the action and target for production migrations/data writes, PR merges, live deployments, deployment/security configuration changes and additional infrastructure costs. Development or preview approval does not authorize these actions.
- Keep production read-only until authorized. Do not run live signup/review/profile/upload/delete tests without authorization for those writes. BEGIN/ROLLBACK is not a substitute for approval.
- Never execute DROP, DELETE, TRUNCATE, unrestricted UPDATE, resets or migration-history repairs against live services without explicit approval for the concrete operation.
- Recovered/applied migrations and root-level dated SQL are historical documentation: never replay them on the existing project. Distinguish them from new, proposed migrations using DEVELOPMENT.md and the live migration ledger.
- Never put migration execution in build/install/startup scripts, CI or Vercel hooks. A static deployment must not execute SQL.
- Do not create paid branches/projects, upgrade plans or incur additional infrastructure costs without explicit scope/price approval. Use isolated local databases and synthetic fixtures by default.

## Credentials and privacy

- Run credentialed production backups on the owner’s computer, outside Git, using [the owner-run recovery procedure](docs/backup-recovery.md). Synthetic restore tests do not pass the production recovery gate.
- Never commit or disclose credentials, secret/service-role keys, API tokens, passwords, cookies, auth state, private keys or sensitive user records. Keep backups outside Git/artifacts in approved secure storage.
- Browser publishable keys and project URLs are public configuration, not permission to change policies. Preserve Auth, RLS and Storage protections. Do not grant private user IDs to visitors to simplify aggregation.
- Prefer direct service integrations; use secure browser sign-in only when necessary. Never request secrets in chat or disable Turnstile to get a test to pass.

## Verification and release

- Before integrating a feature into development, run the full cumulative regression suite documented in DEVELOPMENT.md against the combined tree. Test against isolated databases and synthetic browser fixtures. After a verified milestone, record the integrated commit and keep a Git checkpoint.
- Check the exact-head Vercel preview, its build logs and affected behavior before proposing release. Clearly distinguish synthetic/mocked/local tests from hosted verification and disclose untested Auth/provider/storage flows.
- For documentation-only PRs, verify facts, links and scope and confirm runtime and SQL are unchanged.
- Production changes require a reviewed sequence, backup/recovery gate and rollback procedure. After authorized release, verify commit, deployment state, intended domains and affected functionality. Preserve new data during rollback; do not automatically drop the expanded schema or restore an old database snapshot.
- Keep DEVELOPMENT.md current after approved architecture, migration or release changes. Record durable release details in the relevant docs/ report; keep both root documents concise.
