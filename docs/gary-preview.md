# Rated420 HQ founder preview

Gary is a synthetic workspace for reviewing founder workflows. The integrated preview uses the Rated420 Build 02 HQ and its synthetic role adapter. The standalone edition opens directly into the founder workspace.

- Base revision `a7e8e2dc322e71b16d93f7a03347633bacfec8e1` is the verified Build 02 source checkpoint. It supplies the existing HQ, roles, visual conventions, catalog, and synthetic test adapter.
- Local branch `preview/gary-hq`. The package's `SOURCE.txt` records the exact source checkpoint.
- Demo state stays under `rated420-gary-preview-v1` in the browser's local storage. Each browser profile and origin has its own copy. The workspace is intended for one working tab. The two founder personas simulate attribution.

## Launch and reset

1. Extract the ZIP into its own folder. Keep its files and subfolders together.
2. On macOS, double-click **Launch Gary.command** and keep the Terminal window open. If Finder does not launch it, open Terminal, type `cd ` with a trailing space, drag the extracted folder into Terminal, and press Return. Then run `/usr/bin/perl ./serve-offline.pl`.
3. In Chrome, open `http://127.0.0.1:8767/` if it did not open automatically. The launcher needs the system Perl executable and an available port 8767. It serves packaged files on loopback and requires no packages or internet. The loopback origin gives JavaScript a secure context for local record IDs and a stable origin for persistence. Use this address instead of double-clicking index.html.
4. To start over, use **Reset founder demo** and confirm. Existing drafts and changes in this demo copy are erased. To stop the server, press Control-C in the launcher window.

For the integrated developer preview, run `RATED420_GARY_PREVIEW=1 node scripts/build.mjs`, serve `dist` on loopback using your local static server, pass the age prompt, select **Staff member**, open **Rated420 HQ**, and select **Founder workspace**. `#hq/gary/opportunities` is an example direct entry subject to the same role gate. A regular or signed-out user sees the HQ access message. The flag is read only for a local synthetic build. Normal builds omit the fixture files, standalone shell, and founder navigation entry.

## Walkthrough

1. **Outreach to production.** In Industry directory filter by Cultivator. Open Hudson Lantern Farm, follow Maya Vale, and choose Add to campaign. Use Hudson Valley farm tours and Hudson Lantern Farm. Personalize Maya's draft, approve the recipient, simulate delivery, then log a reply and choose a follow-up date. Open the thread to see the outgoing message, reply, and linked task. Compose a templated reply and select Hudson Lantern media kit as its simulated attachment. In Business development, open Hudson Lantern farm feature and set the stage to Confirmed. Add a Cultivation tour in Production planning, link the farm, Maya, the opportunity, and the media kit, then set the date and status Scheduled. Open Calendar view and select the matching month. The organization and opportunity profiles link to the related records. Overview links to the updated counts and Founder tasks links to the thread.
2. **Intake to approval.** Open Leafly in Data integrations and choose Connect mock provider, then Run mock product intake. Amber Trail Flower matches an existing branded product. Link duplicate to resolve it. Try approving Missing name and observe validation. Correct it with a unique name and category, approve the corrected row, then open its catalog record. Use Open import provenance to return to the source batch and see the review history. The raw value remains visible.
3. **Controls.** Riley West is an approved seed recipient marked Do not contact. Try Simulate delivery and observe the block. Try delivery for Maya before approving her personalized draft. In the integrated preview, try the founder route as Reviewer B and while signed out. Reset the standalone demo and confirm the fixtures return.

## Modules and preview limits

| Module | Reviewable behavior and limits |
| --- | --- |
| Overview | Counts and filtered drill-downs, open tasks, recent activity. Activity retains the latest 100 local entries. |
| Industry directory and contacts | Search, sort, overlapping classifications, editable profiles, multi-organization roles, relationships and contact suppression. Location and license are descriptive fields. Website and social references are displayed as text. |
| Correspondence | Inbox, Sent, Drafts, templates, threading, attachments, dated follow-ups, attribution and send approval. Delivery is a manual mock transition with date and suppression checks. |
| Campaigns | Target categories, chosen recipients, draft and schedule, per-recipient approval, response, and counts. The sequence is a written plan and follow-up tasks are scheduled manually. |
| Business development | Linked records, optional value, private notes and assignable stages. Custom stages are appended to the seeded list. |
| Production | List and month calendar, scheduling, assignments and references. Media is a descriptive reference. |
| Product intelligence | Separate product profiles with supply-chain relationships, strain text, cannabinoids, terpenes, media, lab and demo review references, corrections and simulated approval. Approval changes the demo catalog state. |
| Data integrations | Mock sources and sync history, staged rows, normalization, validation, duplicate linking, manual corrections and provenance. The same synthetic intake fixture powers each provider example. Real provider terms remain unverified. |
| Documents | Bundled synthetic media kit, record associations, categories and local version history. Added versions retain a filename and note; file bytes remain on the user's device. |
| Tasks and activity | Due dates, assignment, completion, correspondence links and local audit history. There are no background reminders. |

The standalone package uses synthetic identities and a local role persona selector. Its mailbox label is for planning. The simulator performs no actual sign-in, mail delivery, provider requests, or publication.

## Proposed backend model

| Domain | Relational entities |
| --- | --- |
| Industry and verification | `organizations`, `classifications`, `organization_classifications`, `organization_relationships` with typed edges, `locations`, `organization_locations`, `licenses` with issuer and effective dates, and `organization_verifications`. |
| People and authorization | `contacts`, `contact_organization_roles` with organization, title, effective dates, and provenance, `contact_channels`, `contact_suppressions`, and `founder_assignments`. Reuse approved HQ staff roles and Supabase Auth user IDs for the actors. Industry contacts are independent of account identities. |
| Catalog | `hq_brands`, `hq_products`, `product_organizations` with supply role, `product_locations`, `product_sources`, `product_verifications`, `product_media`, and `product_lab_reports`. Link to existing Rated420 catalog and strain IDs via an explicit mapping. Reuse public review IDs and existing review calculations on approved public records. |
| Correspondence | `mailboxes`, `mail_threads`, `mail_messages`, `message_participants`, `message_attachments`, `message_templates`, `message_approvals`, and `delivery_attempts`. Keep provider IDs unique per mailbox. |
| Outreach | `campaigns`, `campaign_classifications`, `campaign_recipients` keyed by campaign/contact/organization, `campaign_drafts`, `campaign_recipient_events`, and `sequence_steps`. Reference the actual draft version in each approval and delivery record. |
| Work | `opportunities`, `opportunity_stages`, `opportunity_stage_events`, `production_projects`, project participant and asset tables, and `tasks` with foreign keys for each supported parent. |
| Documents | `documents`, immutable `document_versions` with object key and checksum, and typed joins for contact, organization, project, opportunity and correspondence. |
| Intake and operations | `external_sources`, `source_permissions`, `import_batches`, `import_rows`, `import_conflicts`, `import_decisions`, and append-only `admin_activity` with actor and timestamps. Retain raw fields and normalized fields with review history under an approved retention policy. |

Private work stays in staff-authorized tables and buckets. Release approved fields through an explicit projection into the existing public catalog and preserve existing listing, review and media identifiers. Keep private contact details, communications, drafts, source payloads and working notes outside the public projection.

## Integration sequence and decisions

1. Verify the staging backup and isolated restoration before any Build 02 migration. The DigitalOcean VPS and recovery volume are still unverified. Reconcile database records and Auth relationships, then compare Storage object keys, sizes and checksums after restoration. Review the restore and rollback evidence before authorizing a migration.
2. Review founder roles and approval authority, allowed stage and relationship values, private retention, and public publication fields. Implement the real server-side repository and RLS in a separately approved isolated candidate. Test anonymous, regular, staff and administrator permissions for every operation. Keep attribution server-side.
3. Add private document storage and short-lived access links. Use immutable version records and redact sensitive content and credentials from audit logs. Check backup and restore for metadata and object bytes together.
4. Approve the Gmail mailbox connection, scope, storage and retention independently. Use server-held OAuth secrets and tokens, a revocation path, delivery idempotency, an outbox, a final suppression check and explicit send authorization. Review whether approval requires a second person.
5. Establish access, storage and redistribution terms provider by provider. Set scoped credentials server-side, confirm field ownership and permitted usage, and test idempotent intake in isolation. Review duplicate matching and the public publication mapping before moving any records to public surfaces.

## Local verification

Use `node --test tests/build-isolation.test.mjs tests/contact-handler.test.mjs` for the build and contact checks. Use the repo's existing browser fixture tests for Build 02 and the Playwright harness in `tests/gary.browser.cjs` for Gary. The Gary harness expects an extracted package running on port 8767 and the opt-in integrated build in `dist`. Set `RATED_TEST_CHROME` to a compatible local browser executable if needed. It blocks every request outside the local fixture origin and checks for attempted off-origin requests.
