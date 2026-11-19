-- Staging-only supplement for a fresh install of the historical catalogue seed.
-- Source: Rated420 public strain catalogue, verified November 19, 2026.
-- No user identifiers, review records or private data are included.
begin;
lock table public.strains in share row exclusive mode;
do $$
begin
  if exists (select 1 from public.strains where
      id = 19 and name <> 'Lemon OG Haze' or lower(name) = 'lemon og haze' and id <> 19) then
    raise exception 'Strain ID 19 or the name Lemon OG Haze already belongs to another listing';
  end if;
  insert into public.strains (id, name) overriding system value
  values (19, 'Lemon OG Haze') on conflict (id) do nothing;
  -- Advance only when the historical seed has left the sequence below the last imported ID.
  if (select last_value from public.strains_id_seq) < 19 then
    perform setval('public.strains_id_seq', 19, true);
  end if;
end $$;
commit;
