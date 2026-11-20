# Rated420 Catalogue Intelligence

Open the included `Launch Rated420.command` on macOS or follow the manual local server instructions in README.md. Browse **Explore → Interconnected catalogue**. Use **Demo controls** to switch between a reviewer, business representative, moderator and founder. In HQ, open **Catalogue Manager** to review proposals, draft or publish records and review media permissions. The Accessories tab opens the existing editorial editor.

## Records and ownership

Catalogue entities have stable internal IDs. A finished product links to one cultivar, brand and producer or processor, and any number of dispensaries. Reverse navigation is derived from these associations. Accessories retain their existing editorial records and scorecards. Synthetic products show no product-specific score where one has not been established. Stash adds the linked cultivar to a reviewer's wishlist. Existing review IDs and calculations remain independent of catalogue publication and OCM licensing. Contributor recognition uses **SCORE = R + 3C + P**.

The bundled [OCM inventory](https://data.ny.gov/d/jskf-tt3q) identifies the following locations by a combination of license number and state location ID. License status is a snapshot. Catalogue association does not establish a partnership or current stock.

| Profile | Licensee and location | OCM license |
|---|---|---|
| Treehouse Cannabis | The Next Chapter NY LLC, Nyack | OCM-CAURD-24-000122 |
| Kings House of Fire | KINGS RAW Property LLC, Cortlandt Manor | OCM-CAURD-24-000104 |
| Peek Buds | NYSafe 420 LLC, Peekskill | OCM-CAURD-26-000342 |
| The Flowery | Green Veteran NY LLC, Haverstraw | OCM-RETL-24-000157 |
| Kushmart | OKKERSNY LLC, Haverstraw | OCM-RETL-24-000060 |

RYTHM, Find., The Botanist and Nanticoke have editorial profile shells linked to first-party sites. Exact manufacturer/product associations, cannabinoids, lab data, stock and retail associations need authorized evidence. The Field Signal brand, North Loop Dispensary, Hudson Lantern Farm and their product associations are fictional.

## Media inventory and workflow

The Treehouse profile reuses the existing Rated420-supplied carousel photograph and links to its existing episode. Original marks and signage pictured in the editorial photograph are distinct from permission to use a standalone logo. Other catalogue profiles use Rated420 placeholders. Standalone logos, manufacturer product photography, brand imagery and other storefront images are outstanding. Record source, rights holder, attribution, acquisition date and alternative text for each asset. Uploads are optimized to WebP with a maximum dimension of 900 pixels and stored in the current browser. Authorization and publication are separate; archive is available for removals. Confirm rights, allowed use, territory, expiration and takedown obligations before collecting real commercial assets.

## Commercial source feasibility

| Source | Legitimate path and remaining checks |
|---|---|
| [Dutchie POS](https://api.pos.dutchie.com/swagger/index.html) | Publicly documented integration surface. Seek partner access and authorized retailer scopes; confirm inventory visibility, location/product identifiers and reuse rights. |
| [Jane Catalog](https://www.iheartjane.com/business/catalog) | Standardized catalogue and first-party brand content indicate a possible authorized feed. Confirm export access, stable product and variant identifiers, geography, attribution and image rights. |
| [LeafLink](https://api.leaflink.com/) | Public documentation is the starting point for an approved wholesale integration. Wholesale data alone cannot establish retail availability. Confirm authorized scopes, retention and display rights. |
| [Weedmaps](https://developer.weedmaps.com/docs/onboarding-process) | Developer onboarding and [terms](https://weedmaps.com/legal/developer-terms) apply. Confirm New York coverage, allowed use and refresh/revocation rules. |
| [Leafly](https://www.leafly.com/info/commercial-terms-of-use) | Request a partner agreement or permitted export. Public materials do not establish bulk catalogue access. |
| [FindWeedNY](https://findweedny.com/) | Prospective discovery source. Verify terms, owner permission, coverage and an authorized export before ingest. |
| First-party brand and retailer sites | Public editorial links and manually verified identity. Obtain written approval for exports, menu data and photographs. |
| Direct submissions | Prefer attributable brand/dispensary exports and signed media permissions for a controlled pilot. |

No commercial feeds are connected. Publicly available menu pages and age gates were not harvested. Synchronization should begin with a contract and a small permitted feed. Use provider-specific IDs plus source, entity type and retail location as import keys. Preview mapping and duplicates before accepting data, preserve source and timestamp, and handle revocations explicitly.

## Backend proposal

Keep the public catalogue, proposals, rights metadata and data-provider ingestion separate from the existing reviews and regulator snapshots. A Supabase design can use `catalogue_entities` with UUID primary keys, one-to-one typed detail tables for strains, products, brands, producers and dispensaries, `product_dispensaries` for retail associations, `external_record_ids` for provider mappings, `licence_locations` keyed by regulator, license and location, `catalogue_revisions` for drafts and published snapshots, `media_assets` for rights and storage metadata, and `catalogue_proposals` plus append-only `catalogue_events` for approvals. Preserve legacy review keys as explicit mappings and add a separate product-specific scorecard contract when its scoring model is approved.

Proposed API boundaries include public reads of published records and authorized assets, organization-scoped proposal creation/status, and staff-only draft/approval/publication commands. Require ownership checks, revision preconditions and transactional writes for approval and publication. Apply RLS to proposals, drafts, history and private assets. Keep drafts in a private Storage bucket with short-lived signed access for staff. Serve only an explicitly approved derivative. Use server-side scoped provider secrets in a separately configured Supabase/Docker environment. Normalize, preview, deduplicate and reconcile incoming records before a staff commit. These are design contracts. This build exercises the workflows in browser-local adapters and adds no migrations or services.

## Scope

The browser sandbox contains synthetic accounts and ratings. Business submissions are visible only to the submitting demo account and permitted staff in the same browser. A proposal becomes a draft after staff approval and appears publicly only after publication. The browser demo models access rules for evaluation. It does not provide backend authorization, account isolation across tabs, commercial synchronization, or live publication. Reset restores seed records and clears demo changes.
