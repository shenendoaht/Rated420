# Owner-run backup and recovery

Status: tooling is verified with synthetic data; **production recovery is not verified**. Run credentialed exports on the owner's computer, as requested. Do not upload backups, passwords, keys, table fingerprints or private manifests to GitHub, chat or this development workspace. Nothing here authorizes a production restore, migration or release.

## Scope and prerequisites

No new hosted infrastructure or paid upgrade is required. Use existing encrypted local storage and an existing second owner-controlled storage destination. Supabase's Free plan has no independently verified managed restore point here. Database exports contain Auth password hashes and private records: treat even encrypted archives as sensitive.

Use a POSIX environment (macOS/Linux, or appropriately secured WSL2), Python 3, Git, GnuPG, native **PostgreSQL 17** `psql`, `pg_dump`, `pg_dumpall`, and local Docker. Commands run from the repository root. Native Windows file permissions have not been verified. The Docker disk and scratch location must be on encrypted storage; do not assume deleting a file securely erases it from SSDs, snapshots or swap.

1. Fetch the reviewed feature branch `codex/community-averages`; read AGENTS.md and DEVELOPMENT.md. These scripts are absent from the production website.
2. Prepare a private directory **outside every Git worktree**, mode 0700. Keep the existing database password and server-side Storage credential in separate mode-0600 regular files there. Obtain them privately from the existing password manager/service dashboard. **Do not reset passwords, regenerate keys, paste secrets in chat or place secrets in shell commands/history.** If you cannot access existing credentials, stop and request assistance.
3. Select an existing trusted local GPG encryption key, or generate a local password-protected encryption-capable key using `gpg --full-generate-key`. Verify its full fingerprint locally (`gpg --with-colons --fingerprint`). Back up the private key and recovery passphrase separately in existing secure storage. Test decryption before depending on it. Losing the private key/passphrase makes these backups unrecoverable. Do not enable shell tracing or record credential-entry screens.
4. Keep a private inventory of existing Auth provider/SMTP/redirect settings, JWT/encryption/Vault key recovery material, Edge Function secrets, Turnstile/Resend and domain configuration in the owner's password manager. Logical database/Storage backups do **not** replace those service secrets/settings. Do not change or reissue them as part of backup preparation.

Example non-secret path variables (replace the paths/fingerprint locally):

```sh
umask 077
R420_RECOVERY_ROOT=/absolute/path/on/encrypted-disk/rated420-recovery
R420_GPG_FINGERPRINT=REPLACE_WITH_VERIFIED_FULL_FINGERPRINT
mkdir -p "$R420_RECOVERY_ROOT/credentials" "$R420_RECOVERY_ROOT/scratch"
chmod 700 "$R420_RECOVERY_ROOT" "$R420_RECOVERY_ROOT/credentials" "$R420_RECOVERY_ROOT/scratch"
```

## Private connection files

Create `credentials/pg_service.conf` using a local editor, not a command containing a password. Copy the **direct or session pooler** connection metadata from Supabase Connect for project `ymluyoqkmzxomjokjmkj`. Port must be **5432**, not transaction pooler 6543. Direct DNS may require IPv6; session pooler is the alternative. Template for direct access:

```ini
[rated420-backup]
host=db.ymluyoqkmzxomjokjmkj.supabase.co
port=5432
dbname=postgres
user=postgres
sslmode=verify-full
sslrootcert=system
```

For session pooling, replace host with the exact provider `.pooler.supabase.com` hostname and user with `postgres.ymluyoqkmzxomjokjmkj`. Keep TLS verification; use an independently verified CA file if the OS trust store cannot verify it. Do not weaken `sslmode`. Host-address overrides, arbitrary libpq options, inline passwords and connection URLs are refused.

Create `credentials/database.pgpass` privately in libpq format `host:5432:postgres:user:password`, matching the chosen host/user exactly. Escape `:` and `\` in the password according to libpq passfile rules. Store the **existing** password; never put it in argv/environment/chat. Create `credentials/storage-key` containing only the existing server-side Storage secret/service-role credential with access to **all** buckets, including private ones. A browser publishable key is insufficient. Never expose it to frontend code.

```sh
chmod 600 "$R420_RECOVERY_ROOT/credentials/pg_service.conf" \
  "$R420_RECOVERY_ROOT/credentials/database.pgpass" \
  "$R420_RECOVERY_ROOT/credentials/storage-key"
```

## Capture encrypted exports

Choose a quiet window without disabling writes or changing production. Use new output directories each attempt. The database script uses verified TLS, read-only session options, a full custom-format `pg_dump` without schema/table/owner/ACL exclusions, and encrypted role metadata. It includes Auth users/identities/password hashes, application data, schema definitions, policies and Storage metadata. Database-role login passwords are intentionally omitted; keep existing copies in the password manager.

```sh
python3 scripts/backup/database_export.py \
  --service-file "$R420_RECOVERY_ROOT/credentials/pg_service.conf" \
  --pass-file "$R420_RECOVERY_ROOT/credentials/database.pgpass" \
  --recipient "$R420_GPG_FINGERPRINT" \
  --output "$R420_RECOVERY_ROOT/database-capture-01"

python3 scripts/backup/storage_export.py export \
  --project-ref ymluyoqkmzxomjokjmkj \
  --key-file "$R420_RECOVERY_ROOT/credentials/storage-key" \
  --recipient "$R420_GPG_FINGERPRINT" \
  --output "$R420_RECOVERY_ROOT/storage-capture-01"

python3 scripts/backup/storage_export.py verify \
  --output "$R420_RECOVERY_ROOT/storage-capture-01"
```

The Storage exporter uses only HTTPS bucket/object GETs and Storage's read-only object-list POST. It recursively paginates all buckets and streams each object's bytes into GPG before disk writes. Names, metadata and checksums are in an encrypted manifest; filenames are opaque. No upload/delete/bucket mutation is implemented. Database fingerprints/manifests and archives are encrypted too. Only sanitized counts/status/times are printed; provider error bodies are suppressed.

`COMPLETE.json` indicates an export completed, **not recoverability**. SQL access/export errors, denied tables, drift, incomplete downloads or encryption failures block completion. No rows/schemas/extensions may be silently omitted to obtain a pass. Database before/after fingerprints and Storage before/after inventories must match. There is no atomic snapshot across both services; the combined restore also compares object IDs, sizes, metadata and update timestamps. On drift, retain the old files privately for investigation and retry both exports to new directories in a quiet window; do not freeze production without authorization. Automatic periodic scheduling is not installed: repeat before an approved migration and after material data growth, using unique dated private directories and reviewing results.

## Verify recovery in a disposable local container

**Never pass a production URL or credential to the restore verifier.** It has no remote database target argument. Only use trusted owner-created archives: database dumps contain executable definitions.

Source last inspected: PostgreSQL **17.11**; extensions include plpgsql 1.0, pgcrypto 1.3, uuid-ossp 1.1, pg_stat_statements 1.11 and **supabase_vault 0.3.2**. A vanilla `postgres:17.6` image is sufficient for synthetic tests, **not the production dump**. Choose and pin a trusted compatible Supabase PostgreSQL image/digest with all source extension versions. The verifier fails before restore if versions are unavailable. A compatible real-production image/managed-schema restore has **not** yet been validated; stop for assistance rather than skipping Vault/managed schemas or guessing a production command.

After reviewing the image, set `R420_RECOVERY_IMAGE` to its verified immutable image reference. Ensure Docker uses the local context (`docker context inspect`); unset `DOCKER_HOST`/TLS overrides if present. Download the image before starting the network-isolated container. Use a fresh, dedicated local container, no published ports, no host bind mounts, no shared volumes. Docker's data disk must be encrypted. Example after assigning the reviewed image:

```sh
docker pull "$R420_RECOVERY_IMAGE"
docker run -d --name rated420-recovery-local --network none \
  --label rated420.recovery=local \
  -e POSTGRES_HOST_AUTH_METHOD=trust "$R420_RECOVERY_IMAGE"
docker exec rated420-recovery-local pg_isready -U postgres

python3 scripts/backup/verify_database_local.py \
  --database-export "$R420_RECOVERY_ROOT/database-capture-01" \
  --storage-export "$R420_RECOVERY_ROOT/storage-capture-01" \
  --container rated420-recovery-local \
  --scratch "$R420_RECOVERY_ROOT/scratch"
```

Wait for local PostgreSQL readiness before verification. Local trust authentication is confined to a container with no network/ports; never configure this on a hosted service. Inspect locally that the image honors these initialization options; do not relax isolation to fix startup.

The verifier requires an empty dedicated cluster with no user databases beyond postgres/templates. It verifies encrypted archive digests, creates source role attributes/memberships with LOGIN disabled locally, then creates a new random local database from template0. It restores pre-data/data/post-data with stop-on-error transactions and preserved owners/grants, suppressing data-load triggers locally to avoid transforming backed-up encrypted values. It compares every inventoried table's row count/content fingerprint, extension versions, table ownership/RLS/ACL and policy definitions, verifies every recovered Storage byte digest, and cross-checks bucket/object metadata with the restored database. The temporary database is dropped afterward; roles remain in this disposable cluster. The raw roles archive is integrity-checked but not blindly executed against an initialized cluster. Database role passwords/settings, hosted service behavior and external secrets are not proven by these checks.

Only `VERIFIED_LOCAL_DATABASE_AND_STORAGE_BYTES` from the **actual production exports** passes this part of the release gate. Synthetic fixture results do not. Auth password hashes and identities are compared as data; actual login, MFA/JWT decryption and Storage API service restoration need a separately reviewed full local Supabase stack and necessary existing secrets. Do not claim application-level disaster recovery or PITR from a logical restore alone.

After a successful check, privately confirm a second encrypted copy and recovery key are accessible. Report only project reference, source/export time, tool commit, PostgreSQL/image versions, sanitized status/counts and limitations. Do not share raw manifests, records, hashes, object paths or archives. A failed check leaves the production release blocked. No full-production restore was performed in development.

Cleanup affects **only the dedicated local recovery container**; confirm its identity/label first:

```sh
docker inspect --format '{{index .Config.Labels "rated420.recovery"}}' rated420-recovery-local
# Only after confirming this is your disposable LOCAL recovery container:
docker rm -fv rated420-recovery-local
```

Remove temporary plaintext/credentials only according to the owner's secure storage policy; retain at least two verified encrypted copies and separate key recovery. Never delete the only backup to clean up. Scratch cleanup occurs on normal exit; after interruption inspect private scratch and Docker resources locally before continuing.

## Production restoration and release boundaries

This procedure has **no production restore command**. Actual disaster recovery requires explicit approval of a concrete target, outage window, existing-secret compatibility, Auth/Storage service recovery, and handling writes after the backup. Restoring an old snapshot can permanently discard newer legitimate records; it is not the PR #7 rollback plan. After a committed PR #7 migration, retain the compatible expanded schema and use only an explicitly approved frontend rollback.

Before PR #7 release: obtain the owner's real recovery evidence, repeat read-only exposure/ledger/data preflight, review the latest PR head and exact migration hash, and obtain renewed explicit approval. See [release plan](pr7-release-plan.md). Never replay recovered historical migrations or use db reset/push as a shortcut.

References: [Supabase backups](https://supabase.com/docs/guides/platform/backups), [PostgreSQL pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html), [libpq passfiles](https://www.postgresql.org/docs/17/libpq-pgpass.html). Supabase database backups contain Storage metadata, not object bytes. Defaults of Supabase CLI dump may exclude managed schemas; these scripts deliberately use native full exports instead.
