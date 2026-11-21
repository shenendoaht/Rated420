# Founder HQ module consolidation

Baseline `ec0a488c8f93e085a56a7e06d60b9770844051ce`. This inventory records existing routes and their placement. S = staff/moderator and above. F = founder or administrator. A = administrator only. These roles gate the browser-local prototype; production authorization remains separate.

| Previous entry and route | Existing function and data | Access | Unified placement |
|---|---|---|---|
| Staff HQ overview `#hq`; Founder overview `#hq/gary` | HQ queue and import summaries; GaryStore work, correspondence and activity. The two overview routes overlapped as entry points. | S, with F-only data | One Today overview selected by role; legacy Founder-root route resolves to the same overview for eligible actors. |
| Work queue → Submissions `#hq/submissions` | Community proposals and approval/revision/rejection through Build 02 adapter; private supporting images. Public contribution route remains separate. | S | Today queue, with pending records on the overview and the full queue underneath. |
| Work queue → Catalog `#hq/catalog`; Catalogue Manager `#hq/catalogue[/records|proposals|media]` | Community listing edits/archive vs editorial drafts, assets, and business proposals; they manage separate datasets and workflows. | S for community, F for editorial | Intelligence, two distinct tools. Catalogue deep links remain valid. |
| Founder Product intelligence `#hq/gary/products` and Data integrations `#hq/gary/integrations` | GaryStore product relationships, simulated provider intake, record reconciliation and approvals. | F | Intelligence, separate from official dataset and editorial catalogue. |
| Data Intelligence `#hq/intelligence[/sources|history|import]` | Bundled NYS licensing, local imports, provenance, diagnostic simulation, proposed settings and batch audit. | S read-only unless F | Intelligence workspace; existing tabs and direct links retained. |
| Territory Explorer `#hq/gary/territory` | Existing map, geographic filters, official counts, synthetic regional business list, local CRM prospects. | F | Intelligence. Record return keeps region and directory view. |
| Analytics `#hq/analytics` | Existing Build 02 cross-app catalog, account, submission, vote and contribution summaries. | S | Intelligence. |
| Industry directory and organizations `#hq/gary/organizations[/id]`; contacts `#hq/gary/contacts` | GaryStore organizations and contacts; links to tasks, projects, correspondence, campaigns and opportunities. | F | Relationships. The organization is the record hub, with contextual Back. |
| Correspondence `#hq/gary/threads`; outreach campaigns `#hq/gary/campaigns`; Business development `#hq/gary/opportunities` | Simulated inbox/drafts, outreach approvals and recipient history, local opportunity pipeline. | F | Relationships. Urgent correspondence is also surfaced on Today. |
| Founder tasks and Activity `#hq/gary/tasks`, `#hq/gary/activity` | GaryStore tasks, owners and saved activity log; existing links back to records. | F | Today, with follow-ups and recent activity surfaced on Overview. |
| Production, documents, finance `#hq/gary/production`, `#hq/gary/documents`, `#hq/gary/finance` | GaryStore scheduling, calendar and linked versions; expansion financial ledger, budgets and projections. | F | Operations. Existing linked records and planning disclosure on Today. |
| Polls, Episodes, Showroom `#hq/polls`, `#hq/episodes`, `#hq/showroom` | Build 01 Vault poll actions and Build 02 media or merchandise publishing. | S | Operations. Public Vault and store stay separate. |
| Editorial content `#hq/content` | Team, story and editorial accessories through the existing editor and storage. | F | Operations. |
| Staff access `#hq/access`; acting founder and reset settings | Existing demo role assignment checks; Founder actor simulation. | A for staff access, F for actor controls | Operations for staff access. Demo settings stay collapsed in Founder HQ when supported by the current tool. |

There is one navigation shell. Existing module editors retain their contextual tabs, record history, permission checks, and data stores. Links retain the existing hashes. Dashboard aliases and module return links point to the unified Today view. Cross-module navigation still uses those hashes and should not be interpreted as a database change.
