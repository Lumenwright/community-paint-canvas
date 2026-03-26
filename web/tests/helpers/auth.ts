// Test auth helpers: generate JWTs and session cookies using the same jose library as production.
// No mocking — real signatures, real verification. Tests fail if the production logic is wrong.
import { SignJWT } from 'jose';

// Placeholder credentials matching the test .env values
export const TEST_EXTENSION_CLIENT_ID = 'test_extension_client_id';
export const TEST_EXTENSION_SECRET_B64 = Buffer.from('test_extension_secret_32bytes!!').toString('base64');
export const TEST_SESSION_SECRET = 'test_session_secret_32_chars_!!!';
export const TEST_BROADCASTER_ID = 'broadcaster_001';
export const TEST_CRON_SECRET = 'test_cron_secret';

function extKey(): Uint8Array {
  return Buffer.from(TEST_EXTENSION_SECRET_B64, 'base64');
}

function sessionKey(): Uint8Array {
  return Buffer.from(TEST_SESSION_SECRET);
}

interface ExtJWTOptions {
  twitch_user_id?: string;
  username?: string;
  expiry?: string;
  secret?: Uint8Array;
  client_id?: string;
}

// Generate a valid Extension JWT (mimics what window.Twitch.ext sends to the EBS)
export async function generateExtJWT({
  twitch_user_id = 'user_001',
  expiry = '+5m',
  secret = extKey(),
  client_id = TEST_EXTENSION_CLIENT_ID
}: ExtJWTOptions = {}): Promise<string> {
  return new SignJWT({
    twitch_user_id,
    opaque_user_id: `U${twitch_user_id}`,
    channel_id: 'channel_001',
    role: 'viewer',
    client_id
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(expiry)
    .setIssuedAt()
    .sign(secret);
}

// Generate an expired Extension JWT
export async function generateExpiredExtJWT(opts: ExtJWTOptions = {}): Promise<string> {
  return generateExtJWT({ ...opts, expiry: '-1m' });
}

// Generate a JWT signed with the wrong secret (tampered token)
export async function generateBadSignatureExtJWT(opts: ExtJWTOptions = {}): Promise<string> {
  return generateExtJWT({ ...opts, secret: Buffer.from('wrong_secret_entirely_different!!') });
}

// Generate a JWT with a wrong extension client_id
export async function generateWrongClientIdExtJWT(opts: ExtJWTOptions = {}): Promise<string> {
  return generateExtJWT({ ...opts, client_id: 'wrong_client_id' });
}

interface SessionOptions {
  twitch_user_id?: string;
  username?: string;
  is_mod?: boolean;
  is_broadcaster?: boolean;
}

// Generate a signed session cookie value (same format as production createSessionCookie)
export async function createTestSession({
  twitch_user_id = 'user_001',
  username = 'test_user',
  is_mod = false,
  is_broadcaster = false
}: SessionOptions = {}): Promise<string> {
  return new SignJWT({ twitch_user_id, username, is_mod, is_broadcaster })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .setIssuedAt()
    .sign(sessionKey());
}

export async function createModSession(opts: SessionOptions = {}): Promise<string> {
  return createTestSession({ ...opts, is_mod: true });
}

export async function createBroadcasterSession(opts: SessionOptions = {}): Promise<string> {
  return createTestSession({ ...opts, is_broadcaster: true, is_mod: true });
}

// Generate an expired session cookie
export async function createExpiredSession(opts: SessionOptions = {}): Promise<string> {
  const { twitch_user_id = 'user_001', username = 'test_user', is_mod = false, is_broadcaster = false } = opts;
  return new SignJWT({ twitch_user_id, username, is_mod, is_broadcaster })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('-1m')
    .setIssuedAt()
    .sign(sessionKey());
}
