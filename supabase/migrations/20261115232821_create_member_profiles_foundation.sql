-- Rated420: member profile foundation (passwords stay in Supabase Auth).
create table public.member_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint member_profiles_username_format check (
    username is null or username ~ '^[A-Za-z0-9_]{3,24}$'
  ),
  constraint member_profiles_display_name_length check (
    display_name is null or (
      char_length(btrim(display_name)) between 2 and 60
      and display_name = btrim(display_name)
    )
  )
);
-- Case-insensitive username uniqueness for member handles.
create unique index member_profiles_username_unique
  on public.member_profiles (lower(username))
  where username is not null;
alter table public.member_profiles enable row level security;
-- Only logged-in members can reach this table through the API.
revoke all on table public.member_profiles from public, anon, authenticated;
grant select, insert, update on table public.member_profiles to authenticated;
create policy "members_select_own_profile"
  on public.member_profiles for select
  to authenticated using (id = (select auth.uid()));
create policy "members_insert_own_profile"
  on public.member_profiles for insert
  to authenticated with check (id = (select auth.uid()));
create policy "members_update_own_profile"
  on public.member_profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
