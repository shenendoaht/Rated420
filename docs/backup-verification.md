# Backup/recovery verification and release handoff

Verified November 17, 2026, using only synthetic local data. Tool milestone: **c8361a30211ae608927bc3ac52fabc500433419c** (after e69e204). Later documentation changes do not alter runtime, SQL or backup tools. See [owner-run procedure](backup-recovery.md).

## Results

**8/8 recovery tests pass** (`python3 -m unittest discover -s tests -p test_backup_recovery.py -v`):

- Public/private object payloads encrypt and recover byte-for-byte; encrypted tampering fails integrity validation.
- Changed Storage inventories cannot receive a completion marker.
- Actual Git worktrees, permissive credential files and abbreviated encryption fingerprints are rejected.
- Read-only Storage listing handles nested folders and more than 1,000 results; mutation POSTs are rejected.
- Full native PostgreSQL dump/restore preserves synthetic Auth users/password-hash values/identities, review fields/photo paths, functions, policies and ownership enforcement.
- Combined verifier restores into a new local database, compares row fingerprints/ownership/RLS/ACL/policies and encrypted objects against restored Storage metadata. A same-size object's changed update timestamp rejects the cross-service recovery point.
- Verified TLS and private passfiles are required. Inline passwords, connection-option overrides and host-address overrides are refused; inherited PG environment credentials are removed and read-only PGOPTIONS are set.
- Remote Docker endpoints/host overrides, option-like container names, networked/privileged containers, published ports and host bind mounts are rejected.

Fixtures use a temporary local GPG key and PostgreSQL **17.6** network-none containers, without production URLs/credentials/records. Temporary restore databases and fixture containers are removed after testing. The database export's actual hosted connection/native owner prerequisites are not exercised by synthetic tests.

Also rerun successfully at the tool milestone:

| Suite | Result |
| --- | --- |
| PostgreSQL community averages | 8/8 |
| Contact handler | 10/10 (mock providers) |
| Build isolation | 5/5 |
| Community UI | 1280px and 390px pass |
| Account/session UI | 1280px and 390px pass; real pinned SDK, mocked backend |
| Contact UI | 1280px, 390px and 320px pass, including error paths |
| Production static build, JavaScript/Python syntax, diff whitespace | Pass |

No app/runtime/proposed-migration change since recovered implementation 1c3788b. Production output uses a static asset whitelist: backup tools/docs/SQL/tests, synthetic seed/adapter and controls are excluded. A production build ignores local demo flags. Preview uses labelled browser-local fixtures and blocks production network/form access; it does not prove hosted persistence or real-provider behavior.

## Read-only hosted checks

- Production remains **483b6d16d45f12d2c8aae1f056348e7f2aa80f24**, deployment **dpl_HENB6pUySfADX7NT8XuZbzQFZDiW**, READY. https://rated420ny.com returns HTTP 200, www redirects 308 to apex; no demo adapter is referenced. Contact readiness GET returns ready:true with a public Turnstile site key. No message was submitted.
- Supabase **ymluyoqkmzxomjokjmkj** reports ACTIVE_HEALTHY, PostgreSQL 17.11.0.019. Ledger still contains only the five historical applied migrations through 20261117064837. PR #7 migration is absent.
- Feature preview for tool commit c8361a3, deployment **dpl_Bohe4FqeV8dgHYUvm6JMeDizyJEk**, READY. Build logs confirm isolated synthetic preview/no database commands. Protected HTTP fetch returns 200 with the demo adapter and connect/form isolation policy. Final documentation-head preview status is recorded in the PR/final report.
- Earlier read-only anonymous REST exposure check: public schema query succeeds; community_private is rejected (406 PGRST106). Repeat immediately before any approved release; this is not proof of future post-migration grants/schema-cache behavior.

## Gates and remaining limitations

**Production recovery gate: NOT PASSED.** No real production backup, Storage download, credential acquisition or real-data restore was performed. Owner will run credentialed exports and verification on their own encrypted computer and retain a separate verified encrypted copy/key recovery. A compatible pinned Supabase PostgreSQL image with source extensions (notably supabase_vault 0.3.2) still needs verification for the actual dump. Managed-schema permissions/restore compatibility may fail and must not be bypassed.

Local recovery proves restored database records/policies/table ACLs and object bytes for fixtures. It does not prove hosted login/MFA/JWT/Vault decryption, service configuration, complete role settings/login passwords, Storage API rehydration, automatic scheduling, PITR, or disaster restoration to a hosted project. No production restore procedure is authorized. Fingerprint/inventory scans may be expensive on a larger database; use a quiet window and stop on timeout/drift rather than weakening checks.

No production migrations, merges, live releases, live write tests, policy/secrets changes or paid infrastructure occurred. PR #7 stays draft/unmerged. The reviewed a22841e approval predates later tools/docs; renewed approval must name the latest head and exact SQL after recovery evidence. See [controlled release plan](pr7-release-plan.md) and [handover](CODEX_HANDOVER.md).
