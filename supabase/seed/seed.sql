-- seed.sql
-- Realistic demo data: 1 school, 3 buses, 3 drivers, 3 routes, 20+ students.
-- NOTE: driver/admin auth.users rows must be created first via Supabase Auth
-- (see /docs/local-development.md) — this script assumes their UUIDs are known
-- and substituted below (placeholders shown as :admin_user_id / :driver_1_user_id etc.)
-- or run with real auth.users already seeded via the Supabase dashboard.

insert into schools (id, name_en, name_ar, timezone, default_language)
values ('11111111-1111-1111-1111-111111111111', 'Al Noor International School', 'مدرسة النور الدولية', 'Asia/Muscat', 'en');

insert into system_settings (school_id) values ('11111111-1111-1111-1111-111111111111');

-- Buses
insert into buses (id, school_id, bus_number, registration_number, nickname_en, nickname_ar, capacity, status)
values
  ('21111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'BUS-01', 'OM-12345', 'Bus One', 'الحافلة الأولى', 30, 'not_started'),
  ('22222222-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'BUS-02', 'OM-12346', 'Bus Two', 'الحافلة الثانية', 30, 'not_started'),
  ('23333333-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'BUS-03', 'OM-12347', 'Bus Three', 'الحافلة الثالثة', 25, 'not_started');

-- Drivers (user_id left null here; link via UPDATE once matching auth.users/users rows exist)
insert into drivers (id, school_id, employee_id, full_name, phone, is_active)
values
  ('31111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'EMP-001', 'Ahmed Al Balushi', '+96890000001', true),
  ('32222222-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'EMP-002', 'Mohammed Al Habsi', '+96890000002', true),
  ('33333333-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'EMP-003', 'Ali Al Rashdi', '+96890000003', true);

update buses set default_driver_id = '31111111-1111-1111-1111-111111111111' where id = '21111111-1111-1111-1111-111111111111';
update buses set default_driver_id = '32222222-1111-1111-1111-111111111111' where id = '22222222-1111-1111-1111-111111111111';
update buses set default_driver_id = '33333333-1111-1111-1111-111111111111' where id = '23333333-1111-1111-1111-111111111111';

-- Routes (morning, home -> school)
insert into routes (id, school_id, name_en, name_ar, direction, default_bus_id, default_driver_id)
values
  ('41111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Morning Route A', 'المسار الصباحي A', 'home_to_school', '21111111-1111-1111-1111-111111111111', '31111111-1111-1111-1111-111111111111'),
  ('42222222-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Morning Route B', 'المسار الصباحي B', 'home_to_school', '22222222-1111-1111-1111-111111111111', '32222222-1111-1111-1111-111111111111'),
  ('43333333-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Morning Route C', 'المسار الصباحي C', 'home_to_school', '23333333-1111-1111-1111-111111111111', '33333333-1111-1111-1111-111111111111');

-- Stops for Route A (coordinates are illustrative points around Muscat)
insert into route_stops (id, route_id, sequence, name_en, name_ar, address, location, estimated_arrival_time, stop_type)
values
  ('51111111-1111-1111-1111-111111111111', '41111111-1111-1111-1111-111111111111', 1, 'Al Khoudh', 'الخوض', 'Al Khoudh, Muscat', ST_SetSRID(ST_MakePoint(58.1614, 23.5880), 4326)::geography, '06:45', 'pickup'),
  ('51111111-1111-1111-1111-111111111112', '41111111-1111-1111-1111-111111111111', 2, 'Al Hail', 'الحيل', 'Al Hail, Muscat', ST_SetSRID(ST_MakePoint(58.1339, 23.5990), 4326)::geography, '07:00', 'pickup'),
  ('51111111-1111-1111-1111-111111111113', '41111111-1111-1111-1111-111111111111', 3, 'Mawaleh', 'الموالح', 'Mawaleh, Muscat', ST_SetSRID(ST_MakePoint(58.1500, 23.5820), 4326)::geography, '07:12', 'pickup'),
  ('51111111-1111-1111-1111-111111111114', '41111111-1111-1111-1111-111111111111', 4, 'Seeb', 'السيب', 'Seeb, Muscat', ST_SetSRID(ST_MakePoint(58.1890, 23.6703), 4326)::geography, '07:24', 'pickup'),
  ('51111111-1111-1111-1111-111111111115', '41111111-1111-1111-1111-111111111111', 5, 'School', 'المدرسة', 'Al Noor International School', ST_SetSRID(ST_MakePoint(58.2000, 23.6100), 4326)::geography, '07:40', 'dropoff');

-- 20 demo students distributed across Route A's four pickup stops
do $$
declare
  stop_ids uuid[] := array[
    '51111111-1111-1111-1111-111111111111',
    '51111111-1111-1111-1111-111111111112',
    '51111111-1111-1111-1111-111111111113',
    '51111111-1111-1111-1111-111111111114'
  ];
  i int;
  new_student_id uuid;
begin
  for i in 1..20 loop
    new_student_id := uuid_generate_v4();
    insert into students (id, school_id, student_code, name_en, grade, class_name, guardian_name, guardian_phone)
    values (
      new_student_id,
      '11111111-1111-1111-1111-111111111111',
      'STU-' || lpad(i::text, 4, '0'),
      'Demo Student ' || i,
      (2 + (i % 6))::text,
      chr(65 + (i % 3)),
      'Guardian ' || i,
      '+9689' || lpad((1000000 + i)::text, 7, '0')
    );

    insert into student_route_assignments (student_id, route_id, stop_id)
    values (new_student_id, '41111111-1111-1111-1111-111111111111', stop_ids[1 + (i % 4)]);
  end loop;
end $$;
