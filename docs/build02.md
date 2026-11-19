# Rated420 Build 02

## Source and environment

- Repository shenendoaht/Rated420, local branch `rebuild/build-02`, separate worktree `work/rated420-build02`.
- Verified Build 01 base `45a526c6bf4f93bad2a24f623d1a925bc925434f`. The Build 02 candidate is the committed tree printed by `git rev-parse rebuild/build-02`. The offline archive records the resolved full SHA.
- Milestones `d159cd4` for catalog, HQ, Vault and showroom integration, `b34b20d` for eligibility and recovery coverage, followed by the verification and handoff checkpoints in `git log --oneline 45a526c..rebuild/build-02`.
- GitHub main `483b6d16d45f12d2c8aae1f056348e7f2aa80f24` and development `1fc350b0ef94f0bf3fab61903fef1c89fe7ba4e6` were observed by read-only ref lookup. The webhook endpoint still returns HTTP 403. Vercel's repository configuration and the checked-in GitHub workflow omit the rebuild branch, but separate webhooks cannot be ruled out.
- Existing private Build 01 Vercel deployment `dpl_GPRKNpKveYCowfqWAWDYKnNNH1vW` reported Ready. Build 01 staging database `ldlaeayqtehqtusydsse` reported eight applied migrations, one synthetic Auth account, three Storage buckets and three synthetic objects. The public Rated420 homepage returned HTTP 200 and its HTML matched the prior baseline checksum. No live data export was used.

## Features and product choices

- Shared violet palette with green accents, existing typography and media, responsive discovery and HQ controls. The Shop uses illustrated concept artwork derived from the existing Rated420 logo with the pot leaf.
- `#discover` searches all four categories. Sort by name, average, review count or listing date. Filter by listing kind, review format and rating status. Missing listing dates sort last. Existing direct scorecard routes and identifiers remain.
- Authenticated members propose a strain, brand, dispensary or accessory in `#contribute`. Dispensaries require location. The owner can resubmit after Needs Revision. Staff can revise fields, approve, reject, request revision or associate an existing same-category listing ID. Corrected content and the original attribution are preserved. Supporting photos stay private to the submitter and staff. Staff may archive a catalog entry from discovery and restore it without deleting relationships or changing its ID. Existing direct listing references remain available where the old routes expose them.
- Build 01's five sliders, per-user strain weighting, other averages, favorites, avatar behavior and poll voting remain. The new database permission requires moderation before an unlisted strain or dispensary can be rated. Existing listings remain eligible for the previous frontend during rollback.
- Rated420 HQ checks the current Auth actor using a fixed-operation security-definer RPC with a fixed search path. Staff use existing staff membership. Administrators can assign or remove staff access for a verified Auth UUID. Ordinary staff cannot assign roles. For Shen and Al, verify their exact Auth UUIDs out of band and review who needs administrative privileges. An authorized database operator bootstraps administrators in the private administrators and existing staff tables, then verifies audit and access. Hosted assignments require separate approval.
- Moderate, catalog edit, library, role and poll management writes are audited. Private tables have RLS enabled, no authenticated or anonymous direct schema access and no email projection. The private photo bucket limits size and MIME types, matches upload folders to Auth, and permits staff or owner retrieval. Abandoned uploads may remain private until a reviewed cleanup policy exists.
- Analytics totals cover accounts, listings, review records, proposal status, poll status, votes and unique voters. Format counts use strain review product type. Period selection applies to review creation and the dated vote trend. Counts with no date remain in lifetime totals and are identified separately. Catalog counts follow current discovery visibility. Mark synthetic hosted testers in `rated420_hq.test_accounts` before check activity. The local demo intentionally includes synthetic participants so reviewers can inspect calculations.
- Lifetime rankings use one review unit per actor and strain-format, dispensary or rated brand/accessory. Existing aggregate scores still use the Build 01 rules. Rejected, duplicate, associated and archived contributions earn nothing. Only distinct ballots count, including ballots from closed polls. Overall points are reviews + 3 × approved new listings + distinct polls. Ties share the competition rank with usernames ordering tied rows. Provisional badges are Top Reviewer at 5 review units, Catalog Pioneer at 3 approved listings, Community Voice at 3 polls and Rated420 Elite at 12 overall points. Public recognition requires the existing username/identity opt-in. Private profile photos and ballot choices stay private.
- `#episodes` opens the Vault library. Verified video destinations are seeded for AETERNA and TREEHOUSE. Dates have been left blank pending editorial confirmation. Staff choose artwork, ordering, visibility, optional release date and a closed poll to recap. The public recap reports final counts alongside the episode. The official YouTube and Instagram destinations are preserved.
- `#shop` shows T-shirt, hoodie, cap and sticker concept previews with no prices or purchase controls. HQ can manage title, description, bundled artwork, order and visibility. Themes, merchandise previews and recognition thresholds are provisional.
- Footer Contact Us and the contact page use a selectable `mailto:rated420.ny@gmail.com` address. The Build 01 contact code, database and private Edge Function remain dormant for recovery. The Build 02 build omits the contact script and sends no email.

## Reproduction and checks

```sh
npm ci --prefix tests/ci
tests/ci/node_modules/.bin/playwright install --only-shell chromium
bash tests/ci/postgres-fixture.sh rated420-averages-pg postgres
node --test tests/*.test.mjs
python3 -B -m unittest discover -s tests -p 'test_*.py'
bash tests/ci/build02-recovery.sh
VERCEL_ENV=production VERCEL_GIT_COMMIT_REF=main node scripts/build.mjs
node scripts/build.mjs
export NODE_PATH="$PWD/tests/ci/node_modules"
for suite in tests/*.browser.cjs; do node "$suite"; done
```

The runtime remains framework-free. The existing npm lockfile covers the test runner. The retained staging build flags in `.env.example` point only to an explicit separate Supabase project. No email secrets are needed. A local static server can serve `dist/`. The offline package includes its own loopback-only launcher and bundled fonts, and records the exact source and browser test platform.

## Migration, rollback and approval

- New version `20261119190000_build02.sql` extends Build 01 in place. A separate idempotent editorial seed is `preview/build02-content.sql`. Fresh and restored PostgreSQL checks use synthetic Auth and Storage schema stubs. Check the staged migration ledger and real Supabase APIs separately. Existing vote and brand/accessory review dates are left unknown.
- Before a staged change, verify the project and make authorized staging-only snapshots of PostgreSQL and Storage. Apply the new migration once in the ledger and optionally seed reviewed content. Check role and Storage policy behavior with separate synthetic accounts, confirm authentication isolation, then deploy the immutable new build to the already private, unlinked Vercel project.
- Roll back the app by serving the previous Build 01 deployment; keep the migrated database intact for preservation. Existing ratings work, but Build 01's direct new listing writes remain blocked under Build 02 moderation. To restore full old behavior, verify the pre-migration snapshot with permissions, rows and object paths in an isolated database, reconcile writes since the snapshot and obtain approval before redirecting staging. Do not drop the new tables as a frontend rollback. Actual hosted Storage byte recovery is distinct from restoring SQL photo references.
- Proposed targets are Vercel `rated420-build01` (`prj_AXC82gsoS37zeQcV3LRX5XyqtvEs`) and Supabase `rated420-build01` (`ldlaeayqtehqtusydsse`). Request explicit approval for staging-only snapshot, migration/seed, synthetic Auth and Storage checks, and manual deployment. A push is unnecessary for manual deployment and remains blocked by unknown webhook behavior. Production promotion, access for real staff, credentials and production recovery require separate approval.

## Verification record

The local matrix includes the Build 01 browser regressions at 1280px and 390px, the new HQ and community flows at those widths in Chrome 116 on Linux, and the email contact route at 320px, 390px and 1280px. The rating regression checks two strain contributors, the 152.5 to 175 edit with an unchanged count, four scorecards, favorites and profile/media behavior. The new SQL tests exercise member, staff, administrator and anonymous authorization, duplicate proposals, repeat approvals, synthetic activity exclusions and private submission object metadata policies. The isolated database rehearsal verifies the fresh migration chain, repeat-safe editorial seeding, a dump/restore into a second database and a Build 01 RPC read against the migrated database.

The hosted Build 02 checks remain pending. The standalone Storage API fixture and legacy production-style backup wrapper could not complete within this workspace's Docker disk capacity. The SQL rehearsal validates object references and checked policy logic. Hosted Auth and private upload/download verification still needs the approved staging environment. On a space-constrained workstation, `BUILD02_RECOVERY_CONTAINER=rated420-averages-pg bash tests/ci/build02-recovery.sh` can reuse the network-isolated fixture container. Run it separately from the SQL regression suite because their fixtures define the same database roles.
