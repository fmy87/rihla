-- supabase/tests/_grants_mock.sql
-- On a real Supabase project, the authenticated/anon roles already have
-- these grants set up by the platform itself — our migrations never need
-- to grant them because they're never running against anything else. This
-- file exists only so RLS actually gets exercised (not just silently
-- bypassed) when testing against a plain local Postgres — see
-- docs/testing-rls.md.

grant usage on schema public to authenticated, anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;
grant execute on all functions in schema public to authenticated, anon;
grant usage on all sequences in schema public to authenticated;
