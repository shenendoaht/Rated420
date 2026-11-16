# Rated420 database history

The files in migrations/ were recovered from the connected project's migration history, preserving original versions and SQL statements:

1. 20261115232821_create_member_profiles_foundation.sql
2. 20261116002045_create_strain_catalogue_reviews_and_photo_bucket.sql
3. 20261116004719_rated420_dispensary_and_avatars.sql

All three are already applied to project `ymluyoqkmzxomjokjmkj`. Do not execute them again on that project. The root-level dated SQL files are legacy copies of migrations 2 and 3; do not apply both sets.

For an empty Supabase project, apply these migrations in order using the Supabase migration workflow. Auth and Storage schemas must be provisioned by Supabase. Dashboard Auth settings, redirect URLs, SMTP and passwords are not part of these SQL files. Point the static app's public project URL/key at the intended backend separately.

Do not repair migration history or reset the live database merely to import these files. Compare local versions with `supabase migration list` after linking the correct project. Future migrations should be generated with `supabase migration new <name>`.

See [the backend audit](../docs/backend-audit.md) for verified settings, limitations and pending work. No new live migration was applied during reconciliation.
