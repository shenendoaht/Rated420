-- Existing accounts keep their review identity private unless they opt in.
alter table public.member_profiles
  add column show_review_identity boolean not null default false;

grant select (id, username, avatar_choice) on public.member_profiles to rated420_community_reader;
create policy community_review_identity_read on public.member_profiles
  for select to rated420_community_reader
  using (show_review_identity and username is not null);

create function community_private.strain_review_display()
returns table (
  id uuid, strain_id bigint, product_type text, total integer,
  created_at timestamptz, username text, avatar_choice smallint
)
language sql stable security definer set search_path = '' as $$
  select review.id, review.strain_id, review.product_type, review.total,
    review.created_at, profile.username, profile.avatar_choice
  from public.strain_reviews as review
  left join public.member_profiles as profile on profile.id = review.user_id;
$$;

alter function community_private.strain_review_display() owner to rated420_community_reader;
revoke all on function community_private.strain_review_display() from public;
grant execute on function community_private.strain_review_display() to anon, authenticated;

create view public.strain_community_reviews with (security_invoker = true) as
  select * from community_private.strain_review_display();
revoke all on public.strain_community_reviews from public, anon, authenticated;
grant select on public.strain_community_reviews to anon, authenticated;
