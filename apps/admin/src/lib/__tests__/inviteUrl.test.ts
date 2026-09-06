import { describe, it, expect } from 'vitest';
import { buildInviteUrl } from '../inviteUrl';

describe('buildInviteUrl', () => {
  it('joins a base URL and token with /invite/', () => {
    expect(buildInviteUrl('https://parent.example.com', 'abc123')).toBe('https://parent.example.com/invite/abc123');
  });

  it('strips a single trailing slash from the base URL', () => {
    expect(buildInviteUrl('https://parent.example.com/', 'abc123')).toBe('https://parent.example.com/invite/abc123');
  });

  it('strips multiple trailing slashes from the base URL', () => {
    expect(buildInviteUrl('https://parent.example.com///', 'abc123')).toBe('https://parent.example.com/invite/abc123');
  });

  it('works with a localhost dev URL', () => {
    expect(buildInviteUrl('http://localhost:5174', 'devtoken')).toBe('http://localhost:5174/invite/devtoken');
  });
});
