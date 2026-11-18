#!/usr/bin/env bash
set -euo pipefail

db=rated420-storage-db
database=rated420_storage_api_fixture
storage=rated420-storage-api
image='supabase/storage-api@sha256:4a71028f91060c8d2e86d7426faa6841947d63f4ee97f9683d058d3ec367fb6c'

bash tests/ci/postgres-fixture.sh "$db" "$database"
psql_fixture() {
  docker exec -i "$db" psql -X -U postgres -d "$database" -v ON_ERROR_STOP=1 "$@"
}

psql_fixture <<'SQL'
CREATE ROLE anon NOLOGIN NOINHERIT;
CREATE ROLE authenticated NOLOGIN NOINHERIT;
CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE SQL STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claim.sub',true),''), current_setting('request.jwt.claims',true)::jsonb->>'sub')::uuid;
$$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated;
SQL

# Both services share only the already isolated loopback namespace.
docker pull "$image"
db_id=$(docker inspect "$db" --format '{{.Id}}')
docker run -d --rm --name "$storage" --network "container:$db_id" \
  -e AUTH_JWT_SECRET=rated420-local-fixture-jwt-key-not-for-production \
  -e "DATABASE_URL=postgres://postgres@127.0.0.1:5432/$database" \
  -e FILE_STORAGE_BACKEND_PATH=/tmp/rated420-objects \
  -e STORAGE_BACKEND=file -e FILE_SIZE_LIMIT=52428800 \
  -e GLOBAL_S3_BUCKET=rated420-fixture -e TENANT_ID=rated420-local \
  -e REGION=local -e PORT=5500 -e SERVER_PORT=5500 \
  -e POSTGREST_URL=http://127.0.0.1:5501 -e ENABLE_IMAGE_TRANSFORMATION=false \
  "$image"
test "$(docker inspect "$storage" --format '{{.HostConfig.NetworkMode}} {{.HostConfig.Privileged}} {{len .HostConfig.Binds}} {{len .HostConfig.PortBindings}}')" = "container:$db_id false 0 0"

ready=false
for attempt in {1..45}; do
  if docker exec "$storage" node -e "fetch('http://127.0.0.1:5500/status').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))" >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 1
done
if [[ $ready != true ]]; then
  docker logs --tail 20 "$storage" >&2 || true
  exit 1
fi

psql_fixture -c 'GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;'
for migration in \
  supabase/migrations/20261116002045_create_strain_catalogue_reviews_and_photo_bucket.sql \
  supabase/migrations/20261116004719_rated420_dispensary_and_avatars.sql; do
  sed -n '/^insert into storage.buckets/,$p' "$migration" | psql_fixture
done
docker exec -i "$storage" node < tests/storage-api.integration.cjs
