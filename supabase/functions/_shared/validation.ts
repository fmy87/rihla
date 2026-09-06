// supabase/functions/_shared/validation.ts
//
// Pure, dependency-free validation rules used by create-staff-account and
// accept-guardian-invite. Split out specifically so `deno test` can run
// against this file alone — the Edge Functions themselves import
// `https://deno.land/std@.../http/server.ts` and
// `https://esm.sh/@supabase/supabase-js@...`, which need network access at
// import time that isn't available in every environment these tests might
// run in (this repo's own CI sandbox included). None of the logic here
// touches either of those, so it doesn't need them.

/** A driver's login PIN doubles as their Supabase Auth password — same
 *  floor Supabase itself enforces on passwords. */
export function isPinValid(pin: string): boolean {
  return pin.length >= 6;
}

/** Minimum bar for a parent portal account password. */
export function isPasswordValid(password: string): boolean {
  return password.length >= 8;
}

export function isEmailPresent(email: string | undefined | null): boolean {
  return !!email && email.trim().length > 0;
}

export function isFullNamePresent(fullName: string | undefined | null): boolean {
  return !!fullName && fullName.trim().length > 0;
}

export type InviteUsabilityError = 'invite_already_used' | 'invite_expired';

/**
 * Checks a guardian invite's usable-ness against a given "now" (defaults to
 * the real current time — parameterized so tests don't depend on the
 * clock). Used_at is checked before expiry so a used-and-since-expired
 * invite reports the more specific/actionable "already used".
 */
export function checkInviteUsable(
  invite: { usedAt: string | null; expiresAt: string },
  now: Date = new Date()
): { ok: true } | { ok: false; error: InviteUsabilityError } {
  if (invite.usedAt) return { ok: false, error: 'invite_already_used' };
  if (new Date(invite.expiresAt).getTime() < now.getTime()) {
    return { ok: false, error: 'invite_expired' };
  }
  return { ok: true };
}

/** Max wrong-password attempts against an invite's "link to existing
 *  account" path before accept-guardian-invite refuses further tries on
 *  that invite. Exported as a constant (not just hardcoded inline) so the
 *  test suite and the Edge Function can never drift out of sync on the
 *  actual limit. */
export const MAX_INVITE_ATTEMPTS = 5;

export function hasExceededInviteAttempts(failedAttempts: number, max: number = MAX_INVITE_ATTEMPTS): boolean {
  return failedAttempts >= max;
}
