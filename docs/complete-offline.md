# Rated420 Complete Ecosystem Offline

Built from the Rated420 public application and checkpoint `ca020951c8f088b58a10ccd11129483aaf249045`. The package records the precise unified source in `SOURCE.txt`.

## Launch

Extract the ZIP. On macOS, double-click **Launch Rated420.command** and keep Terminal open. If Finder blocks the launcher, open Terminal in the extracted folder and run `/usr/bin/perl ./serve-rated420.pl`. Open `http://127.0.0.1:8768/` in Chrome and pass the age prompt to reach the public homepage. The launcher needs system Perl and port 8768. No installs, backend or credentials are required. Press Control-C to stop.

## Navigation and reconciliation

The original public site, review forms, accounts, administration and founder modules run in the same application on the same local origin. The offline toolbar switches accounts or resets local app, review, profile, photo, founder and journal data.

| Prior build or area | Where to find it and what carries forward |
| --- | --- |
| Public baseline | Home and About contain the original carousel, art, five-category scoring explanation and contact information. Contact includes a local-only inquiry. Existing offsite links show their destination and require internet access outside this preview. |
| Build 01 public | Discover links to strains, dispensaries, brands and accessories. Existing five-category scorecards, averages, expanded individual reviews, favorites and Vault voting are available. Episodes and Shop show the Rated420 media catalogue and merchandise concepts. |
| Build 01 account | My Account has editable display name, handle, avatar presets, private image upload, visibility, personal review history and favorites. Log in or register using fictional `@example.test` addresses and the shared demo password `demo-only-420`. Reset email and password changes require a real service and are unavailable here. |
| Build 02 discovery and recognition | Discover supports categories, filtering and aggregate sorting. Contribute offers listing suggestions and status history. Public profile links provide opted-in handles, preset avatars and badges. |
| Build 02 administration | Rated420 HQ has submission review and revisions, listing moderation, poll, episode, merchandise and analytics tools. Administrator access also offers staff assignments. |
| Founder preview | Select Founder or Administrator, then Rated420 HQ → Founder workspace. Overview, organizations, contacts, mail simulation, campaigns, opportunities, production calendar, products, imports, documents, assigned tasks and activity use the existing workflows. See HQ-WORKSPACE.md for the cross-module walkthrough. |
| Profile and avatar pass | My Account → Profile examples retains the populated, missing and editor examples. The same avatar rendering is used in actual account and community views. |
| HQ and Community Expansion | Founder workspace → Financial Command Center or Territory Explorer. My Account → The Stash covers tried and wishlist products, private notes, favorites and scoring. Community reviews links to confirmed Stash publications and their scored strain pages. See HQ-EXPANSION.md for mock finance, CRM and territory rules. |
| Unified business experience | Business directory → public producer, brand and dispensary profiles with linked products and live-in-demo averages. Business representative → My Account → Business dashboard for the assigned organization and the existing proposal/moderation flow. No earlier dedicated business account dashboard was found in the offline source. |

## Synthetic accounts

- Visitor browses public pages without editing.
- Maya and Riley are separate community reviewers with personal reviews, wishlists and settings.
- Morgan represents Field Signal and can open its dashboard and submit listings for review.
- Camille moderates through the staff tools. Founder-only screens require founder or administrator access.
- Adair is the administrator, including staff access tools.
- Jordan has staff access and can use the founder workspace.

The roles are browser fixtures. Live authorization requires separate authenticated server policies. Reset demo data clears the local preview's demo state. The age attestation is separate.

## Shared data and limitations

The public rating tables supply strain and dispensary aggregates, user history and connected business profile scores. Confirmed Stash publications use the same strain review table. Journal notes are never copied automatically. If an independent scorecard already exists for the same strain, format and brand, edit it from the account rather than overwriting it from the journal. Moderation updates catalogue visibility, and shared HQ organization IDs associate contacts, prospects and territory businesses. Finance and territory metrics remain fictional. Public brand reviews and strain reviews have separate scorecards. Public reviewer identity follows existing opt-in settings.

Email, imports, provider connections, publication beyond the local browser, and external media playback are simulated or unavailable offline. The catalogue, auth adapter, journal, and images are local and browser-specific. Product selection for Stash publication is limited to active strains. Territory metrics are illustrative, while business profile scores use the local review aggregates. The founder workspace and financial and territory adapters retain their established storage boundaries and link via stable organization IDs. Production still needs Supabase auth, policies, normalized entity mapping, audit history, allowed provider credentials and an isolated verified restore. No migration or integration has been run.

## Verification

Use the launchers above and run the browser suites with Chrome 116. The exact checks and results are reported with the distributed build.

The unified browser suite checks public destinations, simulated registration and login, all seven switcher roles, founder finance and territory routes, account-local journal data, public confirmation and propagation to the aggregate, reloading, and catalog moderation. The cumulative browser suites separately cover ratings and review edits, Vault voting, image storage, contact, moderation, founder outreach and import, profile examples, and the prior expansion. See the final handoff for actual browser versions, widths, and the downloaded artifact checksum.
