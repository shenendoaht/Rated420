-- PROPOSED, NOT APPLIED to production. Requires explicit release approval.
-- Existing historical migrations are already applied and must never be replayed.
create table public.dispensaries (
  id bigint generated always as identity primary key,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  location text not null check (char_length(btrim(location)) between 2 and 120),
  name_key text generated always as (lower(btrim(name))) stored,
  location_key text generated always as (lower(btrim(location))) stored,
  created_at timestamptz not null default now()
);
create unique index dispensary_identity on public.dispensaries (name_key,location_key);
alter table public.dispensaries enable row level security;
revoke all on public.dispensaries from public,anon,authenticated;
grant select on public.dispensaries to anon,authenticated;
grant insert (name,location) on public.dispensaries to authenticated;
grant usage,select on sequence public.dispensaries_id_seq to authenticated;
create policy dispensary_catalogue_read on public.dispensaries for select to anon,authenticated using (true);
create policy dispensary_catalogue_add on public.dispensaries for insert to authenticated with check ((select auth.uid()) is not null);

alter table public.dispensary_reviews add column dispensary_id bigint references public.dispensaries(id) on delete restrict;
-- One-time legacy backfill only; runtime aggregation groups by listing ID.
insert into public.dispensaries(name,location)
select distinct on (lower(btrim(name)),lower(btrim(location))) btrim(name),btrim(location)
from public.dispensary_reviews order by lower(btrim(name)),lower(btrim(location)),created_at,id;
update public.dispensary_reviews r set dispensary_id=d.id
from public.dispensaries d where r.dispensary_id is null
  and lower(btrim(r.name))=lower(btrim(d.name)) and lower(btrim(r.location))=lower(btrim(d.location));
alter table public.dispensary_reviews alter column dispensary_id set not null;
create unique index dispensary_review_per_listing on public.dispensary_reviews(user_id,dispensary_id);
create index dispensary_reviews_listing on public.dispensary_reviews(dispensary_id);
grant select (dispensary_id),insert (dispensary_id),update (dispensary_id) on public.dispensary_reviews to authenticated;
grant select (dispensary_id) on public.dispensary_reviews to anon;

-- Older clients can still submit name/location during rollout, using caller RLS.
create function public.resolve_dispensary_review_listing() returns trigger
language plpgsql security invoker set search_path='' as $$
declare listing public.dispensaries%rowtype;
begin
  if tg_op='UPDATE' then
    if new.dispensary_id=old.dispensary_id and (new.name is distinct from old.name or new.location is distinct from old.location) then
      new.dispensary_id=null;
    end if;
  end if;
  if new.dispensary_id is not null then
    select * into listing from public.dispensaries where id=new.dispensary_id;
    if not found then raise exception 'Unknown dispensary listing'; end if;
  else
    select * into listing from public.dispensaries where lower(btrim(name))=lower(btrim(new.name)) and lower(btrim(location))=lower(btrim(new.location));
    if not found then
      insert into public.dispensaries(name,location) values(btrim(new.name),btrim(new.location))
      on conflict (name_key,location_key) do nothing;
      select * into listing from public.dispensaries where lower(btrim(name))=lower(btrim(new.name)) and lower(btrim(location))=lower(btrim(new.location));
    end if;
  end if;
  new.dispensary_id=listing.id; new.name=listing.name; new.location=listing.location;
  return new;
end; $$;
revoke all on function public.resolve_dispensary_review_listing() from public,anon,authenticated;
create trigger resolve_dispensary_review_listing before insert or update on public.dispensary_reviews
for each row execute function public.resolve_dispensary_review_listing();

-- Keep private user IDs out of anonymous queries. These fixed-query helpers run
-- in a non-exposed schema as a NOLOGIN/NOBYPASSRLS read-only role inheriting the
-- existing anon public-review policies. No existing RLS policy is altered.
create role rated420_community_reader nologin inherit nobypassrls;
grant anon to rated420_community_reader;
create schema community_private;
revoke all on schema community_private from public;
grant usage on schema public,community_private to rated420_community_reader;
grant usage on schema community_private to anon,authenticated;
grant select (user_id,dispensary_id,aesthetic,accessibility,staff,menu,overall,total) on public.dispensary_reviews to rated420_community_reader;

create function community_private.strain_stats()
returns table(strain_id bigint,product_type text,review_count bigint,avg_total numeric,avg_aesthetic numeric,avg_aroma numeric,avg_flavor numeric,avg_effects numeric,avg_overall numeric)
language sql stable security definer set search_path='' as $$
  with contributions as (
    select strain_id,null::text as product_type,user_id,avg(total) as total,avg(aesthetic) as aesthetic,avg(aroma) as aroma,avg(flavor) as flavor,avg(effects) as effects,avg(overall) as overall
    from public.strain_reviews group by strain_id,user_id
    union all
    select strain_id,product_type,user_id,avg(total),avg(aesthetic),avg(aroma),avg(flavor),avg(effects),avg(overall)
    from public.strain_reviews group by strain_id,product_type,user_id
  )
  select strain_id,product_type,count(*),avg(total),avg(aesthetic),avg(aroma),avg(flavor),avg(effects),avg(overall)
  from contributions group by strain_id,product_type;
$$;
create function community_private.dispensary_stats()
returns table(dispensary_id bigint,review_count bigint,avg_total numeric,avg_aesthetic numeric,avg_accessibility numeric,avg_staff numeric,avg_menu numeric,avg_overall numeric)
language sql stable security definer set search_path='' as $$
  with contributions as (
    select dispensary_id,user_id,avg(total) as total,avg(aesthetic) as aesthetic,avg(accessibility) as accessibility,avg(staff) as staff,avg(menu) as menu,avg(overall) as overall
    from public.dispensary_reviews group by dispensary_id,user_id
  )
  select dispensary_id,count(*),avg(total),avg(aesthetic),avg(accessibility),avg(staff),avg(menu),avg(overall)
  from contributions group by dispensary_id;
$$;
alter function community_private.strain_stats() owner to rated420_community_reader;
alter function community_private.dispensary_stats() owner to rated420_community_reader;
revoke all on function community_private.strain_stats(),community_private.dispensary_stats() from public;
grant execute on function community_private.strain_stats(),community_private.dispensary_stats() to anon,authenticated;
create view public.strain_community_stats with(security_invoker=true) as select * from community_private.strain_stats();
create view public.dispensary_community_stats with(security_invoker=true) as select * from community_private.dispensary_stats();
revoke all on public.strain_community_stats,public.dispensary_community_stats from public,anon,authenticated;
grant select on public.strain_community_stats,public.dispensary_community_stats to anon,authenticated;
-- No rounding, aggregate cache, scheduled jobs, review deletion or storage changes.
