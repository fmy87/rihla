-- supabase/tests/rls/004_admin_write_isolation.sql
-- 001 covers SELECT isolation; this covers the write side (INSERT/UPDATE/
-- DELETE), which is a separate set of policies (`buses_admin_write` etc,
-- `for all` policies with their own `with check`) that SELECT passing
-- tells you nothing about — a table can correctly hide another school's
-- rows from SELECT while still letting an admin blindly INSERT/UPDATE/
-- DELETE by primary key into them if the write policy's `with check`/
-- `using` clause is missing or wrong. Self-contained: creates its own two
-- schools/admins (ids prefixed b0b00000, distinct from _fixtures.sql's
-- a0a00000 prefix) inside a rolled-back transaction, so it doesn't need
-- _fixtures.sql loaded first and leaves nothing behind either way.

begin;
select plan(5);

insert into schools (id, name_en) values
  ('b0b00000-0000-0000-0000-000000000001', 'Write Test School A'),
  ('b0b00000-0000-0000-0000-000000000002', 'Write Test School B');

insert into auth.users (id, email) values
  ('b0b00000-0000-0000-0000-0000000000a1', 'write.admin.a@fixture.test');
insert into users (id, school_id, role, full_name, email) values
  ('b0b00000-0000-0000-0000-0000000000a1', 'b0b00000-0000-0000-0000-000000000001', 'super_admin', 'Write Admin A', 'write.admin.a@fixture.test');

insert into buses (id, school_id, bus_number, registration_number, capacity) values
  ('b0b00000-0000-0000-0000-0000000000b2', 'b0b00000-0000-0000-0000-000000000002', 'WT-BUS-B1', 'WT-REG-B1', 20);

select set_config('request.jwt.claim.sub', 'b0b00000-0000-0000-0000-0000000000a1', true);
set local role authenticated;

-- INSERT: Admin A can create a bus in their own school.
select lives_ok(
  $$ insert into buses (id, school_id, bus_number, registration_number, capacity)
     values ('b0b00000-0000-0000-0000-0000000000b1', 'b0b00000-0000-0000-0000-000000000001', 'WT-BUS-A1', 'WT-REG-A1', 20) $$,
  'Admin A can INSERT a bus into their own school'
);

-- INSERT: Admin A canNOT create a bus in school B — with_check should
-- block this (RLS violation), not silently succeed.
select throws_ok(
  $$ insert into buses (id, school_id, bus_number, registration_number, capacity)
     values ('b0b00000-0000-0000-0000-0000000000b3', 'b0b00000-0000-0000-0000-000000000002', 'WT-BUS-B2', 'WT-REG-B2', 20) $$,
  '42501',
  'new row violates row-level security policy for table "buses"',
  'Admin A cannot INSERT a bus into school B'
);

-- UPDATE: Admin A can update their own school's bus.
select results_eq(
  $$ update buses set nickname_en = 'Updated' where id = 'b0b00000-0000-0000-0000-0000000000b1' returning nickname_en $$,
  $$ values ('Updated'::text) $$,
  'Admin A can UPDATE their own school''s bus'
);

-- UPDATE: Admin A's attempt to update school B's bus is a silent no-op —
-- the row is invisible to them under RLS, so 0 rows match, not an error.
update buses set nickname_en = 'Hijacked' where id = 'b0b00000-0000-0000-0000-0000000000b2';

-- DELETE: same story for delete.
delete from buses where id = 'b0b00000-0000-0000-0000-0000000000b2';

-- Confirm school B's bus is genuinely untouched and still exists — checked
-- as postgres, which bypasses RLS, so this is a real assertion about the
-- data, not just "Admin A can't see it so the check trivially passes."
reset role;
select is(
  (select nickname_en from buses where id = 'b0b00000-0000-0000-0000-0000000000b2'),
  null::text,
  'School B''s bus was not modified by Admin A''s UPDATE attempt'
);
select is(
  (select count(*)::int from buses where id = 'b0b00000-0000-0000-0000-0000000000b2'),
  1,
  'School B''s bus still exists — Admin A''s DELETE attempt was a no-op'
);

select * from finish();
rollback;
