begin;
create schema if not exists rated420_build;
revoke all on schema rated420_build from public, anon, authenticated;

create table rated420_build.items (
  id text primary key check (id ~ '^[a-z0-9-]+$'),
  kind text not null check (kind in ('brand','accessory')),
  name text not null,
  description text not null default ''
);
create table rated420_build.reviews (
  item text references rated420_build.items on delete cascade,
  actor uuid references auth.users on delete cascade,
  scores smallint[] not null check (
    array_ndims(scores)=1 and cardinality(scores)=5 and array_position(scores,null) is null
    and 0 <= all(scores) and 84 >= all(scores)
  ),
  total integer generated always as (scores[1]+scores[2]+scores[3]+scores[4]+scores[5]) stored,
  notes text not null check (length(notes)<=1200),
  primary key (item, actor)
);
create table rated420_build.favorites (
  actor uuid references auth.users on delete cascade,
  kind text check (kind in ('strain','brand','dispensary')),
  item text,
  primary key (actor,kind,item)
);
create table rated420_build.staff (actor uuid primary key references auth.users on delete cascade);
create table rated420_build.polls (
  id uuid primary key default gen_random_uuid(),
  question text not null check (length(question) between 1 and 160),
  options text[] not null check (
    array_ndims(options)=1 and cardinality(options)=2 and array_position(options,null) is null
    and length(options[1]) between 1 and 80 and length(options[2]) between 1 and 80
    and lower(options[1]) <> lower(options[2])
  ),
  closed boolean not null default false,
  published_at timestamptz not null default now()
);
create table rated420_build.votes (
  poll uuid references rated420_build.polls on delete cascade,
  actor uuid references auth.users on delete cascade,
  choice integer not null check (choice between 1 and 2),
  primary key (poll, actor)
);
create index on rated420_build.votes(poll, choice);

-- Existing reviews and media stay in place. Import brand identities from first-party reviews.
insert into rated420_build.items(id, kind, name, description)
select 'brand-' || md5(lower(trim(brand))), 'brand', min(trim(brand)), 'From the Rated420 catalogue.'
from public.strain_reviews where trim(brand) <> '' group by lower(trim(brand))
on conflict (id) do nothing;

create function public.rated420_build01(operation text, payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := auth.uid();
  item_key text := payload->>'id';
  kind_key text := payload->>'kind';
  can_manage boolean := exists(select 1 from rated420_build.staff where actor=actor_id);
  vote_poll rated420_build.polls%rowtype;
  result jsonb;
begin
  if operation = 'catalog' then
    select coalesce(jsonb_agg(to_jsonb(t) order by t.name), '[]') into result
    from (
      select i.*, count(r.actor) count, avg(r.total) average
      from rated420_build.items i left join rated420_build.reviews r on r.item=i.id
      where i.kind=kind_key group by i.id
    ) t;
  elsif operation = 'item' then
    select to_jsonb(i) || jsonb_build_object(
      'average', avg(r.total), 'count', count(r.actor),
      'favorite', exists(select 1 from rated420_build.favorites where actor=actor_id and kind=kind_key and item=i.id),
      'own', (select jsonb_build_object('scores', scores, 'notes', notes) from rated420_build.reviews where actor=actor_id and item=i.id),
      'reviews', coalesce(jsonb_agg(jsonb_build_object('total',r.total,'username',p.username,'avatar_choice',p.avatar_choice)
        order by r.total desc) filter (where r.actor is not null), '[]')
    ) into result
    from rated420_build.items i left join rated420_build.reviews r on r.item=i.id
    left join public.member_profiles p on p.id=r.actor and p.show_review_identity
    where i.id=item_key and i.kind=kind_key group by i.id;
  elsif operation = 'dispensary_reviews' then
    select coalesce(jsonb_agg(jsonb_build_object('total',r.total,'username',p.username,'avatar_choice',p.avatar_choice)
      order by r.created_at desc), '[]') into result
    from public.dispensary_reviews r left join public.member_profiles p on p.id=r.user_id and p.show_review_identity
    where r.dispensary_id::text=item_key;
  elsif operation = 'polls' then
    select jsonb_build_object('staff',can_manage,'polls',coalesce(jsonb_agg(jsonb_build_object(
      'id',p.id,'question',p.question,'closed',p.closed,
      'vote',(select choice from rated420_build.votes v where v.actor=actor_id and v.poll=p.id),
      'options',(select jsonb_agg(jsonb_build_object('index',n,'label',p.options[n],
        'votes',(select count(*) from rated420_build.votes v where v.poll=p.id and v.choice=n)) order by n)
        from generate_subscripts(p.options,1) n)
      ) order by p.published_at desc), '[]'))
      into result from rated420_build.polls p;
  elsif actor_id is null then
    raise exception 'Log in to continue' using errcode='42501';
  elsif operation = 'review' then
    if jsonb_typeof(payload->'scores') is distinct from 'array' or
       jsonb_array_length(payload->'scores') <> 5 then
      raise exception 'Enter five scores from 0 to 84';
    end if;
    if exists(select 1 from jsonb_array_elements(payload->'scores') s where
      jsonb_typeof(s) <> 'number' or s::text !~ '^(0|[1-9][0-9]?)$') then
      raise exception 'Scores must be whole numbers from 0 to 84';
    end if;
    insert into rated420_build.reviews(item,actor,scores,notes)
    values (item_key,actor_id,array(select s::text::smallint from jsonb_array_elements(payload->'scores') s),trim(coalesce(payload->>'notes','')))
    on conflict (item,actor) do update set scores=excluded.scores, notes=excluded.notes;
  elsif operation = 'favorites' then
    select coalesce(jsonb_agg(jsonb_build_object('kind',f.kind,'id',f.item,'name',coalesce(s.name,d.name,b.name))
      order by coalesce(s.name,d.name,b.name)), '[]') into result
    from rated420_build.favorites f
    left join public.strains s on f.kind='strain' and f.item=s.id::text
    left join public.dispensaries d on f.kind='dispensary' and f.item=d.id::text
    left join rated420_build.items b on f.kind='brand' and f.item=b.id
    where f.actor=actor_id and coalesce(s.name,d.name,b.name) is not null;
  elsif operation = 'favorite' then
    if (payload->>'active')::boolean is true then
      if (kind_key='strain' and exists(select 1 from public.strains where id::text=item_key)) or
         (kind_key='dispensary' and exists(select 1 from public.dispensaries where id::text=item_key)) or
         (kind_key='brand' and exists(select 1 from rated420_build.items where id=item_key and kind=kind_key)) then
        insert into rated420_build.favorites values(actor_id,kind_key,item_key) on conflict do nothing;
      else raise exception 'Listing not found';
      end if;
    else
      delete from rated420_build.favorites where actor=actor_id and kind=kind_key and item=item_key;
    end if;
  elsif operation = 'vote' then
    select * into vote_poll from rated420_build.polls where id=item_key::uuid for update;
    if not found or vote_poll.closed then raise exception 'Voting is closed'; end if;
    insert into rated420_build.votes values(vote_poll.id,actor_id,(payload->>'option')::integer)
    on conflict (poll,actor) do nothing;
    if not found then raise exception 'You have already voted'; end if;
  elsif operation in ('publish','close') and can_manage then
    if operation='publish' then
      insert into rated420_build.polls(question,options)
      values(trim(payload->>'question'),array(select trim(s) from jsonb_array_elements_text(payload->'options') s));
    else
      update rated420_build.polls set closed=true where id=item_key::uuid;
    end if;
  else
    raise exception 'Action unavailable' using errcode='42501';
  end if;
  return coalesce(result, 'null');
end;
$$;
revoke all on function public.rated420_build01(text,jsonb) from public;
grant execute on function public.rated420_build01(text,jsonb) to anon, authenticated;
commit;
