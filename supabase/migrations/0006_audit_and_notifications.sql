-- 0006_audit_and_notifications.sql

create table audit_logs (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid references schools(id) on delete cascade,
  actor_user_id uuid references users(id) on delete set null,
  action text not null, -- e.g. 'student.created', 'pickup.confirmed', 'route.overridden'
  entity_type text not null, -- e.g. 'student', 'route', 'daily_route'
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb, -- before/after diff or extra context
  created_at timestamptz not null default now()
);
create index idx_audit_school_created on audit_logs(school_id, created_at desc);
create index idx_audit_entity on audit_logs(entity_type, entity_id);

-- Future-ready for parent portal / driver push notifications; not sent in v1
-- beyond in-app admin alerts, but the storage shape is here from day one.
create table notifications (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid not null references schools(id) on delete cascade,
  recipient_user_id uuid references users(id) on delete cascade,
  type text not null, -- e.g. 'student_picked_up', 'bus_approaching', 'route_delayed'
  title_en text not null,
  title_ar text,
  body_en text,
  body_ar text,
  related_student_id uuid references students(id) on delete set null,
  related_daily_route_id uuid references daily_routes(id) on delete set null,
  is_read boolean not null default false,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_notifications_recipient on notifications(recipient_user_id, is_read);
