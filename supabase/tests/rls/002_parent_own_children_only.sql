-- supabase/tests/rls/002_parent_own_children_only.sql
-- Migration 0017's whole premise: a parent's session can only ever read
-- their own linked children's rows. Tests both the positive case (their
-- own child) and, more importantly, the negative case (NOT another
-- parent's child in the SAME school) — a same-tenant leak is the one a
-- naive "school_id = current_user_school_id()" policy wouldn't catch,
-- which is exactly why 0017 uses guardian_user_id = auth.uid() instead.

begin;
select plan(8);

-- Parent One is linked to Student One only.
select set_config('request.jwt.claim.sub', 'a0a00000-0000-0000-0000-0000000000e1', true);
set local role authenticated;

select results_eq(
  $$ select name_en from students order by name_en $$,
  $$ values ('Student One') $$,
  'Parent One sees Student One, and only Student One'
);

select is(
  (select count(*)::int from daily_student_assignments),
  1,
  'Parent One sees exactly one assignment (Student One''s today)'
);

select is(
  (select count(*)::int from daily_routes),
  1,
  'Parent One sees the one daily_route carrying Student One'
);

select is(
  (select count(*)::int from gps_locations),
  1,
  'Parent One sees today''s GPS ping for Student One''s bus'
);

select is(
  (select count(*)::int from drivers),
  1,
  'Parent One sees the driver currently driving Student One''s bus'
);

reset role;

-- Parent Two is linked to Student Two, who has NO assignment today —
-- proving Parent Two gets nothing from Parent One's child, not just that
-- Parent Two's own (unscheduled) child correctly shows no route.
select set_config('request.jwt.claim.sub', 'a0a00000-0000-0000-0000-0000000000e2', true);
set local role authenticated;

select results_eq(
  $$ select name_en from students order by name_en $$,
  $$ values ('Student Two') $$,
  'Parent Two sees Student Two, NOT Student One'
);

select is(
  (select count(*)::int from daily_student_assignments),
  0,
  'Parent Two sees zero assignments — Student Two has none today, and Student One''s isn''t visible to them'
);

select is(
  (select count(*)::int from gps_locations),
  0,
  'Parent Two sees no GPS data — they have no child on an active route today'
);

reset role;

select * from finish();
rollback;
