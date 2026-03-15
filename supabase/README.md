# Supabase Migrations

This project now treats `supabase/migrations/` as the source of truth for schema changes.

Current migrations:

- `20260310184700_create_tracked_runs.sql`
- `20260310192300_create_job_applications.sql`
- `20260310202300_create_user_subscriptions.sql`
- `20260315121000_fix_user_subscriptions_updated_at_search_path.sql`
- `20260315123500_fix_tracked_runs_and_job_applications_updated_at_search_path.sql`

Apply them in timestamp order in the Supabase SQL editor or with your preferred Supabase migration workflow.

The legacy root-level SQL files are kept as compatibility wrappers and point back to the migration files.
