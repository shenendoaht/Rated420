#!/usr/bin/env bash
set -euo pipefail

container="rated420-build02-recovery-$$"
cleanup() { docker rm -f "$container" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker run --rm -d --network none --name "$container" -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17.6 >/dev/null
test "$(docker inspect --format '{{.HostConfig.NetworkMode}}' "$container")" = none
for n in {1..30}; do
  if docker exec "$container" pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done
sql() {
  local db=$1
  shift
  docker exec -i "$container" psql -X -qAt -U postgres -d "$db" -v ON_ERROR_STOP=1 "$@"
}
sql postgres <<'SQL'
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create schema storage;
create table storage.buckets(id text primary key,name text,public bool,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(bucket_id text,name text);
alter table storage.objects enable row level security;
create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;
create function storage.extension(text) returns text language sql immutable as $$ select split_part($1,'.',-1) $$;
SQL
for migration in supabase/migrations/*.sql; do sql postgres < "$migration"; done
sql postgres -c "select count(*) from storage.buckets" | grep -qx 4
sql postgres < preview/build01-seed.sql
sql postgres < preview/build02-content.sql
sql postgres < preview/build02-content.sql
sql postgres -c 'select count(*) from rated420_hq.library' | grep -qx 6
sql postgres <<'SQL'
insert into auth.users values ('11111111-1111-4111-8111-111111111111');
insert into public.member_profiles(id,username) values('11111111-1111-4111-8111-111111111111','synthetic_member');
insert into rated420_build.reviews(item,actor,scores,notes) values
('demo-brand','11111111-1111-4111-8111-111111111111',array[71,72,73,74,75]::smallint[],'Synthetic fixture');
insert into rated420_build.favorites values('11111111-1111-4111-8111-111111111111','brand','demo-brand');
insert into rated420_build.votes(poll,actor,choice) values
('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111',1);
insert into storage.objects values('catalog-submissions','11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.png');
SQL
fingerprint() {
  sql "$1" -c "select jsonb_build_array((select count(*) from public.strains),(select jsonb_agg(to_jsonb(r) order by item) from rated420_build.reviews r),(select jsonb_agg(to_jsonb(p) order by id) from public.member_profiles p),(select count(*) from rated420_build.favorites),(select count(*) from rated420_build.votes),(select jsonb_agg(to_jsonb(o)) from storage.objects o),(select count(*) from rated420_hq.library));"
}
before=$(fingerprint postgres)
docker exec "$container" createdb -U postgres recovered
docker exec "$container" pg_dump -U postgres --no-owner postgres | sql recovered
test "$before" = "$(fingerprint recovered)"
# The original Build 01 read interface remains usable after the additive migration.
sql recovered -c "set role anon; select public.rated420_build01('item','{\"kind\":\"brand\",\"id\":\"demo-brand\"}')->>'average';" | grep -Eq '^365(\.0+)?$'
printf '%s\n' 'Fresh migration chain, repeat-safe editorial seed, synthetic DB restore, and Build 01 read compatibility passed.'
