-- Rated420 Build 05: strain directory, authenticated scorecards, community totals.
create table public.strains (
  id bigint generated always as identity primary key,
  name text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint strains_name_valid check (
    char_length(name) between 2 and 100
    and name = btrim(name)
    and name ~ '[[:alnum:]]'
  )
);
create unique index strains_unique_name on public.strains (lower(name));
alter table public.strains enable row level security;
revoke all on table public.strains from public, anon, authenticated;
grant select on table public.strains to anon, authenticated;
grant insert (name, created_by) on table public.strains to authenticated;
create policy "strain_directory_readable" on public.strains
  for select to anon, authenticated using (true);
create policy "members_may_propose_strains" on public.strains
  for insert to authenticated with check (created_by = (select auth.uid()));

create table public.strain_reviews (
  id uuid primary key default gen_random_uuid(),
  strain_id bigint not null references public.strains(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  brand text not null,
  brand_key text generated always as (lower(btrim(brand))) stored,
  product_type text not null default 'Flower',
  aesthetic integer not null,
  aroma integer not null,
  flavor integer not null,
  effects integer not null,
  overall integer not null,
  total integer generated always as (aesthetic + aroma + flavor + effects + overall) stored,
  notes text not null default '',
  photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint review_brand_valid check (char_length(brand) between 2 and 100 and brand = btrim(brand)),
  constraint review_product_type_valid check (product_type in (
    'Flower','Pre-Roll','Infused Pre-Roll','Vape Cartridge','Disposable Vape',
    'Concentrate','Edible','Tincture','Topical','Other'
  )),
  constraint review_scores_valid check (
    aesthetic between 0 and 84 and aroma between 0 and 84 and
    flavor between 0 and 84 and effects between 0 and 84 and overall between 0 and 84
  ),
  constraint review_notes_length check (char_length(notes) <= 3000),
  constraint review_photo_owned check (
    photo_path is null or (
      char_length(photo_path) <= 250
      and split_part(photo_path, '/', 1) = user_id::text
      and photo_path ~ '^[-0-9a-f]{36}/[-0-9a-f]{36}\.(jpg|jpeg|png|webp)$'
    )
  ),
  constraint one_review_per_member_product unique (user_id, strain_id, brand_key, product_type)
);
create index strain_reviews_by_strain on public.strain_reviews (strain_id, created_at desc);
create index strain_reviews_by_user on public.strain_reviews (user_id, created_at desc);
alter table public.strain_reviews enable row level security;
revoke all on table public.strain_reviews from public, anon, authenticated;
grant select on table public.strain_reviews to anon, authenticated;
grant insert (strain_id, user_id, brand, product_type, aesthetic, aroma, flavor, effects, overall, notes, photo_path)
  on public.strain_reviews to authenticated;
grant update (brand, product_type, aesthetic, aroma, flavor, effects, overall, notes, photo_path, updated_at)
  on public.strain_reviews to authenticated;
grant delete on table public.strain_reviews to authenticated;
create policy "public_review_read" on public.strain_reviews
  for select to anon, authenticated using (true);
create policy "member_writes_own_review" on public.strain_reviews
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "member_updates_own_review" on public.strain_reviews
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "member_deletes_own_review" on public.strain_reviews
  for delete to authenticated using (user_id = (select auth.uid()));

create view public.strain_rating_stats with (security_invoker = true) as
  select strain_id, product_type, count(*)::integer as review_count,
    round(avg(total)::numeric, 1) as avg_total,
    round(avg(aesthetic)::numeric, 1) as avg_aesthetic,
    round(avg(aroma)::numeric, 1) as avg_aroma,
    round(avg(flavor)::numeric, 1) as avg_flavor,
    round(avg(effects)::numeric, 1) as avg_effects,
    round(avg(overall)::numeric, 1) as avg_overall
  from public.strain_reviews
  group by strain_id, product_type;
revoke all on table public.strain_rating_stats from public, anon, authenticated;
grant select on table public.strain_rating_stats to anon, authenticated;

insert into public.strains (name) values
 ('Lemon Creamsicle'),('Lemon Cherry Gelato'),('Blue Dream'),('Sour Diesel'),
 ('Super Boof'),('Wedding Cake'),('GMO'),('Runtz'),('Jack Herer'),('Gelato'),
 ('Cherry Maui'),('OG Kush'),('Northern Lights'),('Purple Punch'),
 ('Strawberry Cough'),('White Widow'),('Gary Payton'),('Pineapple Express')
on conflict do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('strain-review-photos','strain-review-photos',true,5242880,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
create policy "member_uploads_own_review_photos" on storage.objects
 for insert to authenticated
 with check (
    bucket_id = 'strain-review-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and lower(storage.extension(name)) in ('jpg','jpeg','png','webp')
 );
create policy "member_reads_own_review_photos_for_management" on storage.objects
 for select to authenticated
 using (bucket_id = 'strain-review-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "member_removes_own_review_photos" on storage.objects
 for delete to authenticated
 using (bucket_id = 'strain-review-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
