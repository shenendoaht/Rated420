# Rated420 Data Intelligence & Market Integration

## Launch and changes

Unzip the complete ecosystem build and open **Launch Rated420.command**. If Finder blocks it, use `/usr/bin/perl ./serve-rated420.pl` in the extracted directory and visit `http://127.0.0.1:8768/`. System Perl is the only launcher prerequisite. The app starts with the public home and age prompt. See README.md for existing ecosystem navigation and SOURCE.txt for the exact release commit.

- Added Data Intelligence Center under staff administration and the founder workspace. Moderator accounts can read. Founder and administrator accounts can commit and revert demos, save sync proposals and create local prospects.
- Added preview, mapped CSV/JSON import, normalization, row validation, duplicate decisions, source records, reversible import batches and audit views. Manual batches stay in the current browser. The global demo reset removes them.
- Added official records to public Business Discovery and Territory Explorer, provenance and links to the upstream record, and executive market metrics. Synthetic ratings, finance, CRM and engagement continue to use their own data.
- Linked a source-verified active license/location to a local CRM organization and a Research opportunity, with duplicate checks. This action does not send correspondence. Existing CRM fields are never overwritten by the import.

## Public snapshot

| Item | Value |
| --- | --- |
| Publisher / dataset | NYS Office of Cannabis Management, [Current OCM Licenses](https://data.ny.gov/d/jskf-tt3q) |
| API | [Public Socrata JSON endpoint](https://data.ny.gov/resource/jskf-tt3q.json), filtered to records with a license number |
| Retrieval | November 20, 2026 |
| Dataset version | `jskf-tt3q@1795131094` from the state's `rowsUpdatedAt` metadata |
| Coverage | 2,673 license/location records, 2,287 distinct license numbers, 2,397 rows marked Active. Active counts refer to rows, not a count of operating businesses. |
| Projection | Original license and location IDs, category, regulatory status, issue/expiration dates, entity and DBA business names, municipality, county and region |
| Usage | [OPEN-NY terms](https://data.ny.gov/d/77gx-ii52) permit lawful reuse, subject to the terms and separate rights in protected materials. No machine-readable dataset-specific license was declared in the portal metadata. The package retains attribution, date, version and digest of the exact projected API response. |

Excluded applicant-only rows, contacts, addresses, ZIPs, equity fields, protected artwork and operational details. Entity and DBA names are included as published business identifiers, which can include sole proprietors' names. Missing data remains unknown. The project makes no official endorsement, regulatory determination or assertion that a business is currently open. External source pages may change after the snapshot date.

The map uses schematic regional groupings. Official regional filters retain the state's labels. The issuance chart shows dated cohorts in the current snapshot. Historical growth, active business counts, and trends across dated snapshots require a longitudinal source. Community rankings and financial estimates are excluded from the official calculation.

## Integrations and rights

- **NY OCM and OPEN-NY**. Reproducible public read-only export. Production synchronization should enforce allowed fields and capture immutable snapshots with date, dataset version and terms. [OCM dispensary verification](https://cannabis.ny.gov/dispensary-location-verification)
- **FindWeedNY**. Public directory observed. No documented, authorized bulk integration was verified. Obtain written access and reuse terms before implementing an adapter. [FindWeedNY](https://findweedny.com/)
- **Weedmaps**. Public developer documentation describes partner onboarding, credentials, menus and orders. API access and catalog retention, republication and analytic rights must be confirmed with Weedmaps. [Developer onboarding](https://developer.weedmaps.com/docs/onboarding-process) · [Developer terms](https://weedmaps.com/legal/developer-terms)
- **Leafly**. Commercial terms are public. Unrestricted catalog or bulk export access was not verified. Obtain an approved partner agreement and coverage information. [Commercial terms](https://www.leafly.com/info/commercial-terms-of-use) · [Terms of use](https://www.leafly.com/info/terms-of-use)
- **Future partners and Rated420**. Use signed scope, field-level licensing, retention, deletion and attribution rules for partners. Proprietary records stay behind their own ACLs; only mock records are available here.

The Sources view persists schedule proposals and local availability diagnostics. It never makes credentials available, runs a background schedule, queries a provider in the browser, or implies a commercial source has authorized ingestion. The dataset selector labels mock provider imports. User-supplied content stays private to the local workspace and is always unverified.

## Backend integration roadmap

Separate presentation (UI), data/provenance store, field mapping/normalization logic, source registry and official snapshot. Proposed normalized records:

| Entity | Identity and access |
| --- | --- |
| sources and source_versions | Source UUID plus immutable upstream version and content digest. Public projections include attribution and retrieval fields. Partner legal documents and all identifiers for secrets remain server-only. |
| import_batches and import_rows | Batch UUID, actor, workspace, source version and decision; per-row source ID and location ID, canonical match, original fields where authorized, and validation outcome. Workspace-scoped RLS. |
| license_locations | Internal UUID, source version FK, external license number and location ID. Unique per source/version/license/location. Regulatory status independent of provenance and review aggregates. |
| business_license_links | Explicit reviewed FK pairs between internal business and source license/location. Keep evidence, reviewer and timestamp. Proprietary business rows have independent policies. |
| crm prospects | Workspace, actor, organization and source-record FK. Enforce idempotent prospect creation, independent outreach state and explicit operator confirmation for any later send. |
| sync proposals and runs | Source FK, run cadence, attempts, cursor, health, last success and failure details. Server scheduler reads only approved sources. Credentials, rate limits and egress restrictions stay server-side. |

Suggested contracts: `GET /market/licensing?region=&category=&asOf=`, `GET /data/sources`, `POST /imports/preview`, `POST /imports/{id}/commit`, `POST /imports/{id}/revert`, `POST /crm/prospects/from-license`, and `PATCH /sources/{id}/schedule`. Commit accepts an actor-bound expiring preview token and an idempotency key. Use checked role guards and transactional writes. Design versioned rollback events rather than mutating source history.

Next milestone: build an isolated, disposable Docker/Postgres contract test for historical snapshots, match-review and publisher-specific permissions, field sanitation and RLS. Require the established verified staging restore before any hosted migration. Recheck source terms before scheduled or paid usage.

## Verification scope

The packaged browser smoke test covers CSV/JSON mapping and validation, local provenance, reversion, official counts, stale-state handling, regional filters, CRM prospects and permission checks. The completion report records actual browser runs and the sandbox rollback reference. No provider integration, historical growth calculation or production backend was tested.
