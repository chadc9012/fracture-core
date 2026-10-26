import test from 'node:test';
import assert from 'node:assert/strict';
import { NATIVE_AUTH_REDIRECT, isNativeApp, parseAuthCallback } from '../../src/integrations/supabase/native-google-auth.ts';

test('the deep link Supabase sends the phone back to is the app scheme', () => {
  assert.equal(NATIVE_AUTH_REDIRECT, 'com.chadc9012.worldfracture://auth/callback');
  assert.equal(isNativeApp(), false, 'outside the Android shell this is never native');
});
test('a PKCE code on the callback is picked up', () => {
  assert.deepEqual(parseAuthCallback(`${NATIVE_AUTH_REDIRECT}?code=abc-123`), { kind: 'code', code: 'abc-123' });
});
test('implicit-flow tokens in the fragment are picked up', () => {
  const r = parseAuthCallback(`${NATIVE_AUTH_REDIRECT}#access_token=AT&refresh_token=RT&expires_in=3600`);
  assert.deepEqual(r, { kind: 'tokens', access_token: 'AT', refresh_token: 'RT' });
});
test('provider errors are surfaced, not treated as a session', () => {
  const r = parseAuthCallback(`${NATIVE_AUTH_REDIRECT}?error=access_denied&error_description=User+cancelled`);
  assert.deepEqual(r, { kind: 'error', message: 'User cancelled' });
  assert.equal(parseAuthCallback(`${NATIVE_AUTH_REDIRECT}?state=x`).kind, 'error');
});
test('links that are not the auth callback are ignored', () => {
  assert.deepEqual(parseAuthCallback('com.chadc9012.worldfracture://invite/xyz'), { kind: 'ignore' });
  assert.deepEqual(parseAuthCallback('https://example.com/?code=1'), { kind: 'ignore' });
});
