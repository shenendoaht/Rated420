-- Read-only fingerprint inventory. Output is private backup metadata, not user rows.
-- PostgreSQL 17; run with psql -X -qAt -v ON_ERROR_STOP=1.
begin isolation level repeatable read read only;
select format(
  'select jsonb_build_object(''schema'',%L,''table'',%L,''rows'',count(*),''sha256'',encode(sha256(convert_to(coalesce(string_agg(h,'''' order by h),''''),''UTF8'')),''hex'')) from (select encode(sha256(convert_to(to_jsonb(t)::text,''UTF8'')),''hex'') h from %I.%I t) fingerprints;',
  n.nspname,c.relname,n.nspname,c.relname)
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where c.relkind in ('r','p') and n.nspname <> 'information_schema' and n.nspname !~ '^pg_'
order by n.nspname,c.relname
\gexec
commit;
