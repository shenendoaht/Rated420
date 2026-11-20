# Rated420 HQ & Community Expansion

Base `f36d96b49282e94772278d3152f8e9a2cd9fb13d`. Branch `preview/hq-community-expansion`. See `SOURCE.txt` for the packaged source commit. The prior Rated420 HQ archive is a separate release artifact.

## Launch

Extract **Rated420-HQ-Community-Expansion-Offline.zip**. On macOS, double-click **Launch Rated420 HQ.command**. If Finder does not launch it, open Terminal, type `cd ` with a trailing space, drag in the extracted folder and press Return. Run `/usr/bin/perl ./serve-rated420-hq.pl`. Leave Terminal open and visit `http://127.0.0.1:8767/`. Stop with Control-C. This uses system Perl and an available loopback port. No dependencies, Docker, or credentials are required.

## Feature inventory and use

- **Financial Command Center** at `#hq/finance`. Choose a month or year. Review posted revenue, expenditure and profit/loss, outstanding receivables/payables, and projected net. Click a chart series to filter the ledger. Monthly rows forecast into future periods from their start date, clamping to month-end. Budget ceilings stay out of profit/loss. Add, edit, delete, sort or search transactions. Assign CRM contacts, campaigns, productions or opportunities. Use Production budgets to compare ceilings against linked posted spend.
- **Territory Explorer** at `#hq/territory`. Select a schematic region on the map or use its adjacent keyboard-accessible controls. Filter business types, relationship status or filming prospects and search by name, product or outreach. Open Business profile for product, CRM, ratings and engagement context. Counts and weighted averages follow the selected results. Business records can be added, edited and deleted.
- **The Stash** at `#community/stash`. Add tried or wishlist entries, favorites, cultivar/flavor preferences and private notes. Use search and filter or sort by rating and date. Try the five existing strain scorecard categories (0–84 each). A tried entry with five scores can open **Preview public review**. The public text starts blank. Check the explicit confirmation before publishing. The separate **Community review preview** at `#community/reviews` displays only product, format, scores and deliberately supplied public text. Publishing the same entry replaces its prior public demo review. Deleting or resetting the private journal leaves previously confirmed public reviews in place. For a clean slate across both, clear the site's browser storage.
- **Existing preview**. The founder workspace and the populated, missing-avatar and owner-edit profiles are still reachable from navigation. The original workflows are documented in `HQ-WORKSPACE.md`. Each expansion editor has a reset for its synthetic data. The integrated app uses `RATED420_GARY_PREVIEW=1 node scripts/build.mjs`. Use staff HQ for financial and territory views, and a signed-in synthetic account for The Stash. Ordinary development, hosted staging and production builds omit the expansion assets.

## Architecture and integration roadmap

Fixtures live in `preview/expansion/fixtures.js`. The UI calls the guarded adapter in `store.js` for list, save, remove, reset and publish. Local records use stable fixture IDs or UUIDs. Finance uses integer cents, while territory and journal data are separate stores. Integrated journal state is namespaced by synthetic account. Local browser storage supports demonstration persistence and does not provide security against a user inspecting their own browser storage. The public projection is separately stored and rendered. The standalone preview uses one synthetic member identity.

Proposed backend contracts and schema (design only):

| Contract | Tables and access |
| --- | --- |
| List/save/delete transactions, budget and projection reports | `finance_transactions(id uuid PK, workspace_id FK, date, status, direction, amount_cents bigint, category, recurrence, contact_id FK nullable, campaign_id FK nullable, project_id FK nullable, opportunity_id FK nullable)`, `production_budgets(id uuid PK, project_id FK, ceiling_cents)`. Restrict read/write to explicitly assigned finance roles under RLS. Store audited revisions and use a separate recurring schedule/payment-event model for actual bookkeeping. |
| List/save/delete territory businesses and report coverage | `territory_regions(id PK, version, geometry)`, `territory_businesses(id uuid PK, region_id FK, organization_id FK nullable, classification, relationship_state, outreach_stage, filming_flag, verified_at nullable, source_id FK nullable)`, `territory_business_products(business_id, product_id)`, `territory_metrics(business_id, period, rating_sum, review_count, engagement_count)`. Scope private leads and commercial data to HQ workspace roles. Account-facing reads should use a separate aggregate projection. |
| List/save/delete journal, preview and publish review | `stash_entries(id uuid PK, user_id FK auth.users, product_id FK nullable, label, brand_id FK nullable, status, favorite, cultivar, flavor, private_notes, scores, updated_at)`. Owner-only select/insert/update/delete RLS with both USING and WITH CHECK. `stash_review_links(user_id, entry_id FK, review_id FK, UNIQUE(user_id, entry_id))` remains owner-only. Preview returns an allowlisted DTO. Publish accepts explicit confirmation and expected entry version in an authenticated transaction, revalidates score bounds and rights, maps an approved catalog item and upserts the existing review representation with public fields only. Never expose the journal table or join it into a public view. |

Next milestone is a disposable Docker database and API contract test using synthetic fixtures, including two-account denial tests, finance role separation and an idempotent publish operation against the existing review schema. Before any hosted Build 02 migration, verify the staging backup and isolated restoration. Validate invoicing rules, role assignments, boundaries, data rights, metrics provenance and publication policy before requesting integration approval.

## Limitations

The finance model is management reporting in USD, without bank feeds, accounting ledgers, partial payments, taxes or accrual rules. Invoices are represented by outstanding transaction rows. The map uses approximate synthetic territories, and ratings, engagement and commercial relationships are fictional. Stash publication writes to a local mock public feed, with no effect on existing live reviews or community averages. The preview has no external services or live data.

## Changelog

- Added synthetic finance, territory and community journal modules to the offline Rated420 HQ experience.
- Added staff-only HQ entry points and the account Stash entry in the opt-in integrated build.
- Preserved the previous launcher names, profile examples and founder workflows.

## Verification

See `VERIFICATION.txt` included with the distribution.
