-- supabase/tests/_auth_mock.sql
-- Supabase-hosted Postgres ships an `auth` schema (auth.users, auth.uid(),
-- etc.) for free — our own migrations assume it exists (every RLS policy
-- calls auth.uid()) but never create it, because in production it's already
-- there. This file recreates just enough of it to run our real migrations
-- and RLS policies against a plain local Postgres for testing. It is never
-- deployed — see docs/testing-rls.md for how/why.

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text
);

-- Supabase's real auth.uid() reads the "sub" claim off the request JWT via
-- a Postgres session/request setting. pgTAP tests fake that same setting
-- with `select set_config('request.jwt.claim.sub', '<uuid>', true)` before
-- each test — see tests/rls/*.sql — so this needs to read the same setting,
-- not just be a stub that always returns null.
create or replace function auth.uid() returns uuid
language sql stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
