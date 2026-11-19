-- Run after restoring first-party strains/reviews and applying the Build 01 migration.
-- Stable keys let this run repeatedly without overwriting curated descriptions.
insert into rated420_build.items(id, kind, name, description)
select 'brand-' || md5(lower(trim(brand))), 'brand', min(trim(brand)), 'From the Rated420 catalogue.'
from public.strain_reviews
where trim(brand) <> ''
group by lower(trim(brand))
on conflict (id) do nothing;
