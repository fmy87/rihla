// supabase/functions/_shared/__tests__/validation.test.ts
// Run with: deno test supabase/functions/_shared/__tests__/
//
// No import from deno.land/jsr/esm.sh on purpose — this suite needs to run
// in environments (including this repo's own sandbox) that don't have
// network access to fetch a test-assertion library at import time. A
// three-line equality check needs no library.

import { isPinValid, isPasswordValid, isEmailPresent, isFullNamePresent, checkInviteUsable, hasExceededInviteAttempts, MAX_INVITE_ATTEMPTS } from '../validation.ts';

function assertEquals(actual: unknown, expected: unknown, msg: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${msg}\n  expected: ${e}\n  actual:   ${a}`);
}

Deno.test('isPinValid — accepts 6+ characters', () => {
  assertEquals(isPinValid('123456'), true, '6 chars should be valid');
  assertEquals(isPinValid('1234567890'), true, '10 chars should be valid');
});

Deno.test('isPinValid — rejects under 6 characters', () => {
  assertEquals(isPinValid('12345'), false, '5 chars should be invalid');
  assertEquals(isPinValid(''), false, 'empty should be invalid');
});

Deno.test('isPasswordValid — accepts 8+ characters', () => {
  assertEquals(isPasswordValid('abcdefgh'), true, '8 chars should be valid');
});

Deno.test('isPasswordValid — rejects under 8 characters', () => {
  assertEquals(isPasswordValid('abcdefg'), false, '7 chars should be invalid');
});

Deno.test('isEmailPresent — rejects empty, whitespace-only, null, and undefined', () => {
  assertEquals(isEmailPresent(''), false, 'empty string');
  assertEquals(isEmailPresent('   '), false, 'whitespace only');
  assertEquals(isEmailPresent(null), false, 'null');
  assertEquals(isEmailPresent(undefined), false, 'undefined');
});

Deno.test('isEmailPresent — accepts a non-empty string', () => {
  assertEquals(isEmailPresent('parent@example.com'), true, 'a real email');
});

Deno.test('isFullNamePresent — same rules as isEmailPresent', () => {
  assertEquals(isFullNamePresent(''), false, 'empty string');
  assertEquals(isFullNamePresent('   '), false, 'whitespace only');
  assertEquals(isFullNamePresent(null), false, 'null');
  assertEquals(isFullNamePresent('Ahmed Al Balushi'), true, 'a real name');
});

Deno.test('checkInviteUsable — ok for an unused, unexpired invite', () => {
  const now = new Date('2026-09-06T12:00:00Z');
  const result = checkInviteUsable({ usedAt: null, expiresAt: '2026-09-10T12:00:00Z' }, now);
  assertEquals(result, { ok: true }, 'should be usable');
});

Deno.test('checkInviteUsable — rejects a used invite even if not yet expired', () => {
  const now = new Date('2026-09-06T12:00:00Z');
  const result = checkInviteUsable({ usedAt: '2026-09-05T12:00:00Z', expiresAt: '2026-09-10T12:00:00Z' }, now);
  assertEquals(result, { ok: false, error: 'invite_already_used' }, 'should report already used');
});

Deno.test('checkInviteUsable — rejects an expired invite', () => {
  const now = new Date('2026-09-11T12:00:00Z');
  const result = checkInviteUsable({ usedAt: null, expiresAt: '2026-09-10T12:00:00Z' }, now);
  assertEquals(result, { ok: false, error: 'invite_expired' }, 'should report expired');
});

Deno.test('checkInviteUsable — a used AND expired invite reports "already used" (more specific/actionable)', () => {
  const now = new Date('2026-09-11T12:00:00Z');
  const result = checkInviteUsable({ usedAt: '2026-09-05T12:00:00Z', expiresAt: '2026-09-10T12:00:00Z' }, now);
  assertEquals(result, { ok: false, error: 'invite_already_used' }, 'used takes priority over expired');
});

Deno.test('checkInviteUsable — exact expiry instant still counts as usable (strictly-after, not on-or-after, is expired)', () => {
  const expiresAt = '2026-09-10T12:00:00.000Z';
  const result = checkInviteUsable({ usedAt: null, expiresAt }, new Date(expiresAt));
  assertEquals(result, { ok: true }, 'now == expiresAt should still be usable');
});

Deno.test('hasExceededInviteAttempts — under the limit is not exceeded', () => {
  assertEquals(hasExceededInviteAttempts(0), false, '0 attempts');
  assertEquals(hasExceededInviteAttempts(MAX_INVITE_ATTEMPTS - 1), false, 'one under the limit');
});

Deno.test('hasExceededInviteAttempts — at or over the limit is exceeded', () => {
  assertEquals(hasExceededInviteAttempts(MAX_INVITE_ATTEMPTS), true, 'exactly at the limit');
  assertEquals(hasExceededInviteAttempts(MAX_INVITE_ATTEMPTS + 10), true, 'well over the limit');
});

Deno.test('hasExceededInviteAttempts — respects a custom max', () => {
  assertEquals(hasExceededInviteAttempts(2, 3), false, 'under a custom lower max');
  assertEquals(hasExceededInviteAttempts(3, 3), true, 'at a custom lower max');
});
