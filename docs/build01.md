# Rated420 Build 01

## Baseline verified November 19, 2026

| Resource | Evidence |
| --- | --- |
| GitHub | `shenendoaht/Rated420`, repository ID `1459410238`, default `main` at `483b6d16d45f12d2c8aae1f056348e7f2aa80f24`; `development` at `1fc350b0ef94f0bf3fab61903fef1c89fe7ba4e6` |
| Branch | `rebuild/build-01` in a separate worktree, based on the verified development SHA. Use `git rev-parse HEAD` to identify the checked-out candidate. |
| Vercel production | `shenendoahts-projects` (`team_8KJM9zcWrJGvRkEVCib0QCEN`), project `prj_C8zzhVqxWD63IhEFulADeDMAYAto`, deployment `dpl_HENB6pUySfADX7NT8XuZbzQFZDiW` READY at the main SHA above |
| Domains | `rated420ny.com` and `rated420-staging.vercel.app` are assigned to the production project. `www.rated420ny.com` redirects to the apex. |
| Supabase | Production ref `ymluyoqkmzxomjokjmkj`. Ledger has five applied migrations ending `20261117064837`. Buckets `strain-review-photos`, `dispensary-review-photos`, `member-avatars`. |
| Recovery | Checked-in owner-run tooling and synthetic restore tests. No production recovery archive or verified restore was available to this worktree. |

The served app.js, styles.css, and contact.js matched main byte for byte. The live homepage HTML SHA-256 matched `main` (`4eb80bebdbdb43892502a117d5e77381f7a102600e9c409857be739efac76695`). The public experience includes age confirmation, a rotating brand carousel, strain and dispensary reviews, contact, and account entry. Development adds unique-reviewer averages, the opted-in strain review disclosure, format guidance and upload recovery. Its two proposed migrations are absent from the live ledger. Build 01 continues from those development features.

Production read-only inventory showed 19 strain catalog records, two individual strain reviews (635 total points), no dispensary reviews, one Auth account, one profile, and one object in the strain review bucket. The two strain reviews cover two listings and two normalized brand names, with two eligible contributions and one photo reference. The live schema has no dedicated brands, accessories, dispensary listing table, or favorites. Production stores review totals on review records. The candidate computes community averages and counts from those rows. Production uses separate terms and data access pathways for account records, profile fields, and public reviews.

## Experience and product choices

The existing static stack and Supabase SDK remain in use. The repository lockfile in `tests/ci` pins Playwright. Build 01 introduces a consistent violet and black palette, a new catalogue entrance, item pages, saved collections and a Vault page. Existing hash routes are retained and item links use `#strains/<id>`, `#dispensaries/<id>`, `#brands/<id>`, and `#accessories/<id>`. Other in-page flows retain their old behavior. Contact is available at `#contact`.

Each category is scored 0–84 with a maximum total of 420. Strain retains Aesthetic, Aroma, Flavor, Effects and Overall. The stored `flavor` field is carried unchanged. Dispensary uses Aesthetic, Accessibility, Staff, Menu and Overall. Provisional brand criteria are Presentation, Consistency, Selection, Transparency and Overall. Provisional accessory criteria are Design, Build quality, Ease of use, Performance and Overall.

Strain averages retain equal weight per reviewer across their brand/format submissions. The item page still shows the prior rounded score with a more precise decimal beneath it when needed. Dispensary, brand and accessory averages count one review per member per item. Public identities follow the development opt-in, using username and preset avatar. Uploaded profile photos remain owner-only, with stock art for reviewers without a public avatar.

Vault polls have two choices, one final ballot per signed-in account, and public counts including while voting is open. Staff membership is server-side and can be granted by a project operator for a specific staging account UUID. Staff can publish and close polls. Closing locks voting while preserving results. YouTube and Instagram addresses match the live footer. Instagram returned HTTP 200. The YouTube channel destination was unavailable to this network and still needs confirmation in staging.

| Supplied visual | Candidate placement |
| --- | --- |
| New York skyline logo | Existing `carousel-1.webp`, home |
| Rated420 flag illustration | Existing `carousel-2.webp`, home and Vault |
| Greenhouse photograph | Existing `carousel-3.webp`, home |
| Treehouse photograph | Existing `carousel-4.webp`, home |
| Chrome Vault emblem | Reviewed from the prompt. No downloadable source file was available to the worktree. |
| Standalone outlined leaf | Reviewed from the prompt. No downloadable source file was available to the worktree. |
| Silver lockup | Candidate uses the repository's existing logo files for header, footer and fallback avatar. The prompt attachment file was unavailable for byte comparison. |
| Purple-background lockup | Reviewed from the prompt. No downloadable source file was available to the worktree. |

Original tracked media remains intact. Socials and assets are versioned as before. The two named accessory fixtures are synthetic-seed entries. Neither has been presented as a verified production review.

### Catalog providers

First-party editorial catalogue and member reviews are the source of truth. Weedmaps documents keyed partner access to retailer menus, a Brand Catalog and a Taxonomy API. Its Menu API targets a partner's menus, so directory-wide dispensary coverage, bulk strain exports, commercial terms, caching permission and pricing remain unverified. Leafly provides public strain and dispensary discovery. No authorized API with the required brand, strain and dispensary export coverage, pricing or redistribution terms was verified for Rated420. New York OCM's [dispensary verification list](https://cannabis.ny.gov/verification) is an option for manually checking licensed dispensaries. Evaluate permitted reuse and coverage of locations before importing. It does not cover needed brand and strain records. No third-party records are seeded.

- [Weedmaps developer onboarding](https://developer.weedmaps.com/docs/onboarding-process)
- [Leafly terms](https://www.leafly.com/info/terms-of-use)

## Build and test

Use Node 24 and the existing Chromium and Docker test setup in [DEVELOPMENT.md](../DEVELOPMENT.md).

```sh
npm ci --prefix tests/ci
tests/ci/node_modules/.bin/playwright install --only-shell chromium
node scripts/build.mjs
python3 -m http.server --bind 127.0.0.1 --directory dist 8080
```

The default build has a synthetic account selector and browser-local state. Use the separate contact browser test for a fake challenge and transport. The handler tests inject a local delivery and database adapter to exercise success, intake failure, provider failure, rate limiting, retry and independent staging recipient routing.

```sh
bash tests/ci/postgres-fixture.sh rated420-averages-pg postgres
node --test tests/*.test.mjs
python3 -B -m unittest discover -s tests -p 'test_*.py'
VERCEL_ENV=production VERCEL_GIT_COMMIT_REF=main node scripts/build.mjs
node scripts/build.mjs
export NODE_PATH="$PWD/tests/ci/node_modules"
for suite in tests/*.browser.cjs; do node "$suite"; done
bash tests/ci/storage-fixture.sh
```

Use `.env.example` for browser-safe staging build variables. The contact Edge Function also requires `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TURNSTILE_SECRET_KEY`, `TURNSTILE_SITE_KEY` and `RESEND_API_KEY`. For a staging backend, set `CONTACT_STAGING_ORIGIN` to the exact test URL, `CONTACT_STAGING_INBOX` to the approved mailbox, and `CONTACT_STAGING_SENDER` to a verified test sender. Keep credentials in the hosted settings. Run builds without database or service credentials.

## Migration and recovery

Use the already documented owner-run encrypted backup procedure for recovery evidence. An isolated PostgreSQL rehearsal can validate compatibility with synthetic data. For hosted staging, seed staging accounts and synthetic reviews by default. Any import of production account data, credentials or private media into staging requires separate authorization and an approved secure process.

1. For a fresh isolated Supabase target, apply the eight tracked migrations lexicographically to the empty app schema. Historical dated root-level copies stay out of the migration path. If upgrading an authorized restore, compare the ledger and apply only missing migrations. Check the database identity before every write.
2. Versions `20261117191511` and `20261118120000` install listing IDs, aggregate views and the opted-in public projection. Version `20261119170000` adds the private Build 01 tables, constrained writes, and a fixed-operation RPC with explicit ownership checks.
3. For an authorized migration on the existing production project, accounts, sessions, tables, and recorded media remain in place. For a future approved move to another project, preserve Auth user/identity UUIDs and the corresponding profile UUIDs before restoring application rows. Confirm provider setup, token issuer and reauthentication or password reset with the owner. Preserve strain IDs, review UUIDs and score/category fields as-is. Backup object bytes separately and restore into buckets with the same privacy and paths. Reconcile the object contents and check authenticated access against staging policies before testing.
4. In an authorized restore, run `scripts/import-build01-brands.sql` after restoring strain review rows. It normalizes brand name keys using lowercase and trim, and inserts only missing listings. Existing strain review totals remain strain scores. Use `preview/build01-seed.sql` only for an isolated synthetic target and assign the test staff account after creating it.
5. Compare table counts, raw point sums, review eligibility, profile/reference IDs and bucket/path checksums against the restored source. The fresh rehearsal yielded 18 built-in strains, three buckets, three fixture items and one poll. Second seed execution added zero records. The staging-only public catalogue supplement, `scripts/import-build01-public-catalog.sql`, brought the count to 19 and preserved the production ID for Lemon OG Haze. Its repeat run left the count unchanged. The upgrade regression preserved the historical strain ID, reviewer UUID, Flavor, point total, and media reference, and preserved all tested dispensary fields. Running the brand import twice produced one normalized listing. Production’s two original review rows, account access, and actual media bytes require the secure carry-forward check. No summary-only data was found in the queried live schema.

Apply migrations independently of app deployment. For app rollback, revert staging to the last known compatible deployment or remove the new private staging deployment if this was its first build. Retain staged records. For a migration error before commit, abort the transaction and inspect the staging ledger and data. After commit, prefer an approved forward fix. If recovery requires restoration, snapshot the current staging database and object inventory first, restore the pre-change snapshot into a separate isolated instance, and verify counts and links before redirecting staging under an approved change. Do not roll back production infrastructure or erase live records as part of staging recovery.

## Staging approval

The connected production projects are excluded. There is no verified existing isolated pair. The proposed target is a new private Vercel project `rated420-build01` in the verified team and a dedicated Supabase project `rated420-build01` with fresh Auth and buckets. Project IDs and URLs can be recorded only after creation or identification of an existing approved pair. Confirm costs, protections, contact provider keys and test inbox before configuration.

Proposed actions are to push `rebuild/build-01` for review (branch config disables Git deployment), provision or attach the approved private pair, apply migrations and synthetic fixtures to the isolated database, and manually deploy the exact candidate SHA. Use two staging test accounts and a staging mail destination. Production promotion, DNS, production backup transfer and production data changes are outside this approval.

## Local verification record

| Checkpoint | Commit |
| --- | --- |
| Baseline | `1fc350b0ef94f0bf3fab61903fef1c89fe7ba4e6` |
| Redesign and application workflows | `5f6d9bdcb4cb7d7152fb0e339affe89a28901456` |
| Synthetic test adapter | `19a9059388a69211c553fee5ab5991aa805adf17` |
| Isolated build and contact configuration, route compatibility and migration checks | `9e363334f17b52c4183ddf198bf2def9c24252a7` |
| Staff publish regressions and contrast corrections | `2aba9efe95a5203b2dd97fad59fff1ba40a3b546` |

Verified locally with 30 Node checks and eight Python synthetic recovery checks. Browser regressions passed at 1280px and 390px for catalogue and scorecards, authentication, and browser storage. Contact also passed at 320px with test transports. Two strain accounts scored 305 and 0. The item displayed 152.5 with two eligible reviews. After changing the first score to 350, it displayed 175 with the same count. The disclosures showed both individual totals, handles and avatars. PostgreSQL checks verified that members cannot overwrite one another’s data. They also covered access to the private Build 01 tables, scores above 84, duplicate ballots, and poll administration restrictions.

The Storage HTTP fixture could not start because Docker ran out of disk while extracting its pinned image. Hosted Auth, Storage, contact delivery, the YouTube destination, and production-data recovery remain open. The candidate SHA is the full output of `git rev-parse rebuild/build-01`. Use that SHA for the clean build and any later approval or hosted testing.
