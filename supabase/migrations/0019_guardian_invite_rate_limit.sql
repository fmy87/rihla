-- 0019_guardian_invite_rate_limit.sql
-- guardian_invites' token itself is unguessable (24 random bytes, hex
-- encoded — 192 bits of entropy), so the realistic attack surface isn't
-- token enumeration, it's password-guessing on the "link this child to an
-- existing account" path in accept-guardian-invite: given a valid,
-- unexpired token and a guessed email, an attacker could try many
-- passwords via signInWithPassword. Supabase's own Auth has some built-in
-- rate limiting, but nothing in this project's own code did before this —
-- this column gives accept-guardian-invite somewhere to count failed
-- attempts per invite and cut it off.

alter table guardian_invites add column if not exists failed_attempts int not null default 0;
comment on column guardian_invites.failed_attempts is
  'Incremented by accept-guardian-invite on each wrong-password attempt '
  'against the "link to existing account" path. The Edge Function refuses '
  'further attempts once this reaches its limit (see '
  'supabase/functions/_shared/validation.ts, hasExceededAttempts) — the '
  'invite is still usable by its rightful owner via a fresh invite from '
  'the admin, it just stops accepting guesses on this one.';
