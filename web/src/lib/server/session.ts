// Signed httpOnly session cookie for the drawing site and mod dashboard.
// Uses HS256 JWT signed with SESSION_SECRET — no external state needed.
import { SignJWT, jwtVerify } from 'jose';
import { SESSION_SECRET } from '$env/static/private';
import type { SessionData } from '../../app.js';

const COOKIE_NAME = 'session';
const TTL = '7d';

function getKey(): Uint8Array {
  return Buffer.from(SESSION_SECRET);
}

export async function createSessionCookie(data: SessionData): Promise<string> {
  return new SignJWT(data as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(TTL)
    .setIssuedAt()
    .sign(getKey());
}

export async function parseSessionCookie(token: string): Promise<SessionData | null> {
  try {
    const { payload } = await jwtVerify(token, getKey(), { algorithms: ['HS256'] });
    return payload as unknown as SessionData;
  } catch {
    return null;
  }
}

export { COOKIE_NAME };
