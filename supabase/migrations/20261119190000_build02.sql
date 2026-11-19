begin;
create schema if not exists rated420_hq;
revoke all on schema rated420_hq from public, anon, authenticated;

create table rated420_hq.administrators (
  actor uuid primary key references auth.users on delete cascade
);
create table rated420_hq.test_accounts (
  actor uuid primary key references auth.users on delete cascade
);
create function rated420_hq.key(value text) returns text
language sql immutable strict set search_path='' as $$
  select lower(trim(regexp_replace(value,'[[:space:]]+',' ','g')))
$$;
create table rated420_hq.submissions (
  id uuid primary key default gen_random_uuid(),
  actor uuid references auth.users on delete set null default auth.uid(),
  kind text not null check (kind in ('strain','brand','dispensary','accessory')),
  name text not null check (length(trim(name)) between 2 and 120),
  location text not null default '',
  description text not null default '' check (length(description)<=1500),
  photo text,
  status text not null default 'Pending' check (status in ('Pending','Approved','Rejected','Needs Revision')),
  listing text,
  created_new boolean not null default false,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users on delete set null,
  note text not null default '' check (length(note)<=1500),
  check ((kind='dispensary' and length(trim(location)) between 2 and 120) or (kind<>'dispensary' and location='')),
  check (photo is null or photo ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|jpg|webp)$'),
  check (not created_new or (status='Approved' and listing is not null))
);
create unique index submissions_active_identity on rated420_hq.submissions
  (kind,rated420_hq.key(name),rated420_hq.key(location))
  where status in ('Pending','Needs Revision');
create index on rated420_hq.submissions(actor,created_at desc);
create index on rated420_hq.submissions(status,created_at);
create unique index contributions_once on rated420_hq.submissions(kind,listing) where created_new;
create table rated420_hq.archive (
  kind text not null check (kind in ('strain','brand','dispensary','accessory')),
  listing text not null,
  primary key(kind,listing)
);
create table rated420_hq.audit (
  id bigint generated always as identity primary key,
  actor uuid references auth.users on delete set null,
  action text not null,
  subject text not null,
  details jsonb not null default '{}',
  at timestamptz not null default now()
);
create table rated420_hq.library (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('episode','merch')),
  title text not null check (length(trim(title)) between 2 and 120),
  description text not null default '' check (length(description)<=1500),
  image text not null default '' check (image in ('','artwork','tee','hoodie','hat','sticker')),
  url text not null default '' check (url='' or url ~ '^https://www\.youtube\.com/watch\?v=[a-zA-Z0-9_-]{11}$'),
  release_date date,
  position integer not null default 0 check (position between 0 and 10000),
  published boolean not null default false,
  poll uuid references rated420_build.polls on delete restrict,
  check (kind='episode' or (release_date is null and url='' and poll is null)),
  check (kind<>'episode' or image in ('','artwork'))
);
create index on rated420_hq.library(kind,published,position);
alter table rated420_build.reviews add column if not exists activity_at timestamptz;
alter table rated420_build.reviews alter column activity_at set default now();
alter table rated420_build.votes add column if not exists activity_at timestamptz;
alter table rated420_build.votes alter column activity_at set default now();

-- Private relations are available exclusively through the checked RPC.
alter table rated420_hq.administrators enable row level security;
alter table rated420_hq.test_accounts enable row level security;
alter table rated420_hq.submissions enable row level security;
alter table rated420_hq.archive enable row level security;
alter table rated420_hq.audit enable row level security;
alter table rated420_hq.library enable row level security;

create function public.rated420_hq_staff() returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from rated420_build.staff where actor=auth.uid())
      or exists(select 1 from rated420_hq.administrators where actor=auth.uid())
$$;
revoke all on function public.rated420_hq_staff() from public;
grant execute on function public.rated420_hq_staff() to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('catalog-submissions','catalog-submissions',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
create policy build02_submission_upload on storage.objects for insert to authenticated
with check(bucket_id='catalog-submissions' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy build02_submission_read on storage.objects for select to authenticated
using(bucket_id='catalog-submissions' and ((storage.foldername(name))[1]=(select auth.uid())::text or (select public.rated420_hq_staff())));

-- Keep historical listings and reviews intact, while routing new entries through approval.
revoke insert(name,created_by) on public.strains from authenticated;
revoke insert(name,location) on public.dispensaries from authenticated;

create view rated420_hq.catalog as
select 'strain'::text kind,s.id::text id,s.name,''::text location,''::text description,s.created_at,
  c.avg_total average,coalesce(c.review_count,0) count
from public.strains s left join public.strain_community_stats c on c.strain_id=s.id and c.product_type is null
union all
select 'dispensary',d.id::text,d.name,d.location,'',d.created_at,c.avg_total,coalesce(c.review_count,0)
from public.dispensaries d left join public.dispensary_community_stats c on c.dispensary_id=d.id
union all
select i.kind,i.id,i.name,'',i.description,(select min(created_at) from rated420_hq.submissions s where s.kind=i.kind and s.listing=i.id and s.created_new),avg(r.total),count(r.actor)
from rated420_build.items i left join rated420_build.reviews r on r.item=i.id group by i.id;

create view rated420_hq.activity as
select r.user_id actor,'review'::text category,r.created_at at from public.strain_reviews r
where not exists(select 1 from rated420_hq.archive a where a.kind='strain' and a.listing=r.strain_id::text)
union all
select r.user_id,'review',r.created_at from public.dispensary_reviews r
where not exists(select 1 from rated420_hq.archive a where a.kind='dispensary' and a.listing=r.dispensary_id::text)
union all
select r.actor,'review',r.activity_at from rated420_build.reviews r
where not exists(select 1 from rated420_hq.archive a join rated420_build.items i on i.id=a.listing and i.kind=a.kind where i.id=r.item)
union all
select actor,'catalog',decided_at from rated420_hq.submissions s where created_new and status='Approved'
and not exists(select 1 from rated420_hq.archive a where a.kind=s.kind and a.listing=s.listing)
union all
select actor,'vote',activity_at from rated420_build.votes;

create view rated420_hq.recognition as
select actor, count(*) filter(where category='review') reviews,
  count(*) filter(where category='catalog') contributions,
  count(*) filter(where category='vote') polls
from rated420_hq.activity a
where not exists(select 1 from rated420_hq.test_accounts t where t.actor=a.actor)
group by actor;

create function public.rated420_build02(operation text,payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  viewer uuid := auth.uid();
  is_staff boolean := public.rated420_hq_staff();
  is_admin boolean := exists(select 1 from rated420_hq.administrators where actor=viewer);
  entry rated420_hq.submissions%rowtype;
  item_kind text := payload->>'kind';
  item_id text := payload->>'id';
  item_name text := trim(payload->>'name');
  item_location text := trim(coalesce(payload->>'location',''));
  decision text := payload->>'status';
  matched text;
  created boolean := false;
  output jsonb;
  range_days integer := case when payload->>'days' in ('7','30','90') then (payload->>'days')::integer else 30 end;
  since timestamptz := now() - make_interval(days=>range_days);
begin
  if operation='role' then return to_jsonb(case when is_admin then 'administrator' when is_staff then 'staff' else 'member' end);
  elsif operation='catalog' then
    select coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object('formats',
      case when c.kind='strain' then (select coalesce(jsonb_agg(distinct product_type),'[]') from public.strain_reviews where strain_id::text=c.id) else '[]'::jsonb end)
      order by c.name),'[]') into output
    from rated420_hq.catalog c where (item_kind is null or c.kind=item_kind)
    and not exists(select 1 from rated420_hq.archive x where x.kind=c.kind and x.listing=c.id);
  elsif operation='library' then
    select coalesce(jsonb_agg(to_jsonb(l)||jsonb_build_object('recap',
      case when p.closed then jsonb_build_object('question',p.question,'options',
        (select jsonb_agg(jsonb_build_object('label',p.options[n],'votes',(select count(*) from rated420_build.votes v where v.poll=p.id and v.choice=n)) order by n) from generate_subscripts(p.options,1) n)) end)
      order by l.position,l.release_date desc nulls last,l.title),'[]') into output
    from rated420_hq.library l left join rated420_build.polls p on p.id=l.poll
    where l.kind=item_kind and (l.published or (is_staff and coalesce((payload->>'manage')::boolean,false)));
  elsif operation='profile' then
    select jsonb_build_object('username',p.username,'avatar_choice',p.avatar_choice,'badges',
      to_jsonb(array_remove(array[case when r.reviews>=5 then 'Top Reviewer' end,case when r.contributions>=3 then 'Catalog Pioneer' end,
        case when r.polls>=3 then 'Community Voice' end,case when r.reviews+3*r.contributions+r.polls>=12 then 'Rated420 Elite' end],null)))
    into output from public.member_profiles p left join rated420_hq.recognition r on r.actor=p.id
    where p.show_review_identity and lower(p.username)=lower(payload->>'username');
  elsif viewer is null then raise exception 'Sign in to continue' using errcode='42501';
  elsif operation='submit' then
    if payload->>'photo' is not null and (
       split_part(payload->>'photo','/',1)<>viewer::text or
       not exists(select 1 from storage.objects where bucket_id='catalog-submissions' and name=payload->>'photo'))
    then raise exception 'Upload your supporting image first'; end if;
    if exists(select 1 from rated420_hq.catalog c where c.kind=item_kind and rated420_hq.key(c.name)=rated420_hq.key(item_name)
              and rated420_hq.key(c.location)=rated420_hq.key(item_location))
      then raise exception 'A matching catalog entry already exists'; end if;
    if item_id is null then
      insert into rated420_hq.submissions(actor,kind,name,location,description,photo)
        values(viewer,item_kind,item_name,item_location,trim(coalesce(payload->>'description','')),payload->>'photo') returning * into entry;
    else
      update rated420_hq.submissions set name=item_name,location=item_location,description=trim(coalesce(payload->>'description','')),
        photo=coalesce(payload->>'photo',photo),status='Pending' where id=item_id::uuid and actor=viewer and kind=item_kind and status='Needs Revision'
        returning * into entry;
      if not found then raise exception 'Only your submissions needing revision can be resubmitted'; end if;
    end if;
    output:=to_jsonb(entry.id);
  elsif operation='mine' then
    select coalesce(jsonb_agg(to_jsonb(s)-'decided_by'-'actor' order by s.created_at desc),'[]') into output
    from rated420_hq.submissions s where s.actor=viewer;
  elsif not is_staff then raise exception 'Rated420 HQ access required' using errcode='42501';
  elsif operation='queue' then
    select coalesce(jsonb_agg(to_jsonb(s)-'decided_by'-'actor' order by s.created_at desc),'[]') into output
    from rated420_hq.submissions s;
  elsif operation='moderate' then
    select * into entry from rated420_hq.submissions where id=item_id::uuid for update;
    if not found then raise exception 'Submission missing'; end if;
    if entry.status in ('Approved','Rejected') then return to_jsonb(entry.listing); end if;
    if decision is null or decision not in ('Approved','Rejected','Needs Revision') then raise exception 'Choose a moderation decision'; end if;
    item_name:=coalesce(item_name,entry.name);
    item_location:=coalesce(trim(payload->>'location'),entry.location);
    if decision='Approved' then
      perform pg_advisory_xact_lock(hashtextextended(entry.kind||':'||rated420_hq.key(item_name)||':'||rated420_hq.key(item_location),0));
      if nullif(payload->>'listing','') is not null then
        select c.id into matched from rated420_hq.catalog c where c.kind=entry.kind and c.id=payload->>'listing';
        if not found then raise exception 'Matching listing not found'; end if;
      else
        select c.id into matched from rated420_hq.catalog c where c.kind=entry.kind and rated420_hq.key(c.name)=rated420_hq.key(item_name)
          and rated420_hq.key(c.location)=rated420_hq.key(item_location) order by c.id limit 1;
        if matched is null then
          created:=true;
          if entry.kind='strain' then insert into public.strains(name,created_by) values(item_name,entry.actor) returning id::text into matched;
          elsif entry.kind='dispensary' then insert into public.dispensaries(name,location) values(item_name,item_location) returning id::text into matched;
          else
            insert into rated420_build.items(id,kind,name,description)
              values(entry.kind||'-'||entry.id,entry.kind,item_name,coalesce(payload->>'description',entry.description)) returning id into matched;
          end if;
        end if;
      end if;
    end if;
    update rated420_hq.submissions set status=decision,name=item_name,location=item_location,
      description=coalesce(payload->>'description',entry.description),listing=matched,created_new=created,
      decided_at=now(),decided_by=viewer,note=trim(coalesce(payload->>'note','')) where id=entry.id;
    insert into rated420_hq.audit(actor,action,subject,details) values(viewer,'moderate',item_id,jsonb_build_object('status',decision,'listing',matched,'created',created));
    output:=to_jsonb(matched);
  elsif operation='manage_catalog' then
    select coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object('archived',a.listing is not null) order by c.kind,c.name),'[]') into output
    from rated420_hq.catalog c left join rated420_hq.archive a on a.kind=c.kind and a.listing=c.id;
  elsif operation='catalog_edit' then
    if not exists(select 1 from rated420_hq.catalog c where c.kind=item_kind and c.id=item_id) then raise exception 'Listing not found'; end if;
    if item_name is null or length(item_name) not between 2 and 120 or length(coalesce(payload->>'description',''))>1500 then raise exception 'Invalid listing'; end if;
    perform pg_advisory_xact_lock(hashtextextended(item_kind||':'||rated420_hq.key(item_name)||':'||rated420_hq.key(item_location),0));
    if exists(select 1 from rated420_hq.catalog c where c.kind=item_kind and c.id<>item_id and rated420_hq.key(c.name)=rated420_hq.key(item_name)
      and rated420_hq.key(c.location)=rated420_hq.key(item_location)) then raise exception 'A matching listing exists'; end if;
    if item_kind='strain' then update public.strains set name=item_name where id::text=item_id;
    elsif item_kind='dispensary' then update public.dispensaries set name=item_name,location=item_location where id::text=item_id;
    else update rated420_build.items set name=item_name,description=coalesce(payload->>'description','') where id=item_id;
    end if;
    if coalesce((payload->>'archived')::boolean,false) then insert into rated420_hq.archive values(item_kind,item_id) on conflict do nothing;
    else delete from rated420_hq.archive a where a.kind=item_kind and a.listing=item_id; end if;
    insert into rated420_hq.audit(actor,action,subject,details) values(viewer,'catalog_edit',item_id,jsonb_build_object('kind',item_kind,'archived',payload->'archived'));
  elsif operation='library_save' then
    if nullif(payload->>'poll','') is not null and not exists(select 1 from rated420_build.polls where id=(payload->>'poll')::uuid and closed)
    then raise exception 'Select a closed poll for the recap'; end if;
    if item_id is not null and not exists(select 1 from rated420_hq.library where id=item_id::uuid and kind=item_kind)
    then raise exception 'Library entry not found'; end if;
    insert into rated420_hq.library(id,kind,title,description,image,url,release_date,position,published,poll)
      values(coalesce(item_id::uuid,gen_random_uuid()),item_kind,trim(payload->>'title'),trim(coalesce(payload->>'description','')),
        coalesce(payload->>'image',''),coalesce(payload->>'url',''),nullif(payload->>'release_date','')::date,
        coalesce((payload->>'position')::integer,0),coalesce((payload->>'published')::boolean,false),nullif(payload->>'poll','')::uuid)
      on conflict(id) do update set title=excluded.title,description=excluded.description,image=excluded.image,url=excluded.url,
        release_date=excluded.release_date,position=excluded.position,published=excluded.published,poll=excluded.poll
      returning to_jsonb(id) into output;
    insert into rated420_hq.audit(actor,action,subject) values(viewer,'library_save',output#>>'{}');
  elsif operation='staff_role' and is_admin then
    if item_id::uuid=viewer then raise exception 'Administrators cannot change their own role'; end if;
    if decision='staff' then insert into rated420_build.staff values(item_id::uuid) on conflict do nothing;
    elsif decision='member' then delete from rated420_build.staff where actor=item_id::uuid;
    else raise exception 'Only member and staff are assignable here'; end if;
    insert into rated420_hq.audit(actor,action,subject,details) values(viewer,'staff_role',item_id,jsonb_build_object('role',decision));
  elsif operation='analytics' then
    select jsonb_build_object('days',range_days,'accounts',(select count(*) from auth.users u where not exists(select 1 from rated420_hq.test_accounts t where t.actor=u.id)),
      'catalog',(select coalesce(jsonb_object_agg(kind,n),'{}') from (select c.kind,count(*) n from rated420_hq.catalog c where not exists(select 1 from rated420_hq.archive a where a.kind=c.kind and a.listing=c.id) group by c.kind) s),
      'reviews',(select count(*) from rated420_hq.activity a where category='review' and not exists(select 1 from rated420_hq.test_accounts t where t.actor=a.actor)),
      'periodReviews',(select count(*) from rated420_hq.activity a where category='review' and at>=since and not exists(select 1 from rated420_hq.test_accounts t where t.actor=a.actor)),
      'formats',(select coalesce(jsonb_object_agg(product_type,n),'{}') from (select product_type,count(*) n from public.strain_reviews r
        where not exists(select 1 from rated420_hq.test_accounts t where t.actor=r.user_id) and not exists(select 1 from rated420_hq.archive a where a.kind='strain' and a.listing=r.strain_id::text) group by product_type) f),
      'submissions',(select coalesce(jsonb_object_agg(status,n),'{}') from (select status,count(*) n from rated420_hq.submissions s where not exists(select 1 from rated420_hq.test_accounts t where t.actor=s.actor) group by status) s),
      'activePolls',(select count(*) from rated420_build.polls where not closed),'closedPolls',(select count(*) from rated420_build.polls where closed),
      'votes',(select count(*) from rated420_hq.activity a where category='vote' and not exists(select 1 from rated420_hq.test_accounts t where t.actor=a.actor)),
      'participants',(select count(distinct actor) from rated420_hq.activity a where category='vote' and not exists(select 1 from rated420_hq.test_accounts t where t.actor=a.actor)),
      'unknownVoteDates',(select count(*) from rated420_hq.activity a where category='vote' and at is null and not exists(select 1 from rated420_hq.test_accounts t where t.actor=a.actor)),
      'unknownReviewDates',(select count(*) from rated420_hq.activity a where category='review' and at is null and not exists(select 1 from rated420_hq.test_accounts t where t.actor=a.actor)),
      'trend',(select coalesce(jsonb_agg(to_jsonb(d) order by day),'[]') from (select (at at time zone 'UTC')::date day,count(*) votes from rated420_hq.activity a where category='vote' and at>=since and not exists(select 1 from rated420_hq.test_accounts t where t.actor=a.actor) group by 1) d),
      'rankings',(select coalesce(jsonb_agg(to_jsonb(z) order by score desc, username),'[]') from (
        select p.username,r.reviews,r.contributions,r.polls,r.reviews+3*r.contributions+r.polls score
        from rated420_hq.recognition r join public.member_profiles p on p.id=r.actor where p.username is not null
      ) z)) into output;
  else raise exception 'Action unavailable' using errcode='42501';
  end if;
  return coalesce(output,'null');
end;
$$;
revoke all on function public.rated420_build02(text,jsonb) from public;
grant execute on function public.rated420_build02(text,jsonb) to anon, authenticated;
commit;
