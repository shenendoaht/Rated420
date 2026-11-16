alter table public.member_profiles
  add column avatar_choice smallint,
  add column avatar_path text,
  add constraint member_avatar_choice check (avatar_choice between 1 and 5),
  add constraint member_avatar_path check (
    avatar_path is null or (
      avatar_choice is null and avatar_path like id::text || '/%'
      and avatar_path ~ '^[-0-9a-f]{36}/[-0-9a-f]{36}\.(jpg|png|webp)$'
    )
  );
grant select (avatar_choice, avatar_path), update (avatar_choice, avatar_path)
  on public.member_profiles to authenticated;

create table public.dispensary_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  location text not null check (char_length(btrim(location)) between 2 and 120),
  aesthetic smallint not null check (aesthetic between 0 and 84),
  accessibility smallint not null check (accessibility between 0 and 84),
  staff smallint not null check (staff between 0 and 84),
  menu smallint not null check (menu between 0 and 84),
  overall smallint not null check (overall between 0 and 84),
  total smallint generated always as (aesthetic + accessibility + staff + menu + overall) stored,
  notes text not null default '' check (char_length(notes) <= 3000),
  photo_path text check (
    photo_path is null or (photo_path like user_id::text || '/%'
      and photo_path ~ '^[-0-9a-f]{36}/[-0-9a-f]{36}\.(jpg|png|webp)$')
  ),
  created_at timestamptz not null default now()
);
create unique index dispensary_review_per_location on public.dispensary_reviews
  (user_id, lower(btrim(name)), lower(btrim(location)));
create index dispensary_reviews_recent on public.dispensary_reviews (created_at desc);
alter table public.dispensary_reviews enable row level security;
revoke all on public.dispensary_reviews from public, anon, authenticated;
grant select (id, name, location, aesthetic, accessibility, staff, menu, overall, total, notes, photo_path, created_at)
  on public.dispensary_reviews to anon, authenticated;
grant select (user_id), delete on public.dispensary_reviews to authenticated;
grant insert (name, location, aesthetic, accessibility, staff, menu, overall, notes, photo_path),
  update (name, location, aesthetic, accessibility, staff, menu, overall, notes, photo_path)
  on public.dispensary_reviews to authenticated;
create policy dispensary_reviews_read on public.dispensary_reviews for select to anon, authenticated using (true);
create policy dispensary_reviews_insert on public.dispensary_reviews for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy dispensary_reviews_update on public.dispensary_reviews for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy dispensary_reviews_delete on public.dispensary_reviews for delete to authenticated
  using (user_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('member-avatars', 'member-avatars', false, 5242880, array['image/jpeg','image/png','image/webp']),
       ('dispensary-review-photos', 'dispensary-review-photos', true, 5242880, array['image/jpeg','image/png','image/webp']);

create policy rated420_new_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id in ('member-avatars', 'dispensary-review-photos')
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and storage.extension(name) in ('jpg', 'png', 'webp'));
create policy rated420_new_photos_select on storage.objects for select to authenticated
  using (bucket_id in ('member-avatars', 'dispensary-review-photos')
    and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy rated420_new_photos_delete on storage.objects for delete to authenticated
  using (bucket_id in ('member-avatars', 'dispensary-review-photos')
    and (storage.foldername(name))[1] = (select auth.uid())::text);
