/**
 * Builds the shareable invite URL an admin copies to send to a parent.
 * Split out from guardianInvites.ts (which imports the Supabase client,
 * and therefore throws in a test environment with no VITE_SUPABASE_* env
 * vars set) purely so this one pure string-building rule is unit testable.
 */
export function buildInviteUrl(baseUrl: string, token: string): string {
  const trimmedBase = baseUrl.replace(/\/+$/, '');
  return `${trimmedBase}/invite/${token}`;
}
