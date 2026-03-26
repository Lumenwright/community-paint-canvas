// Verifies Extension JWTs sent from the Twitch Extension panel.
// Twitch signs these with HS256 using the Extension Secret (base64-encoded).
// Spec: https://dev.twitch.tv/docs/extensions/building/#jwt-schema
import { jwtVerify, SignJWT } from 'jose';
import { TWITCH_EXTENSION_CLIENT_ID, TWITCH_EXTENSION_SECRET } from '$env/static/private';

export interface ExtJWTPayload {
  twitch_user_id: string;
  opaque_user_id: string;
  channel_id: string;
  role: string;
  exp: number;
  iat: number;
}

// Decode the base64 extension secret into a key for jose
function getExtKey(): Uint8Array {
  return Buffer.from(TWITCH_EXTENSION_SECRET, 'base64');
}

export async function verifyExtJWT(token: string): Promise<ExtJWTPayload> {
  const { payload } = await jwtVerify(token, getExtKey(), {
    algorithms: ['HS256']
  });

  // Ensure the token carries the expected Extension client_id
  if (payload['client_id'] !== TWITCH_EXTENSION_CLIENT_ID) {
    throw new Error('Extension client_id mismatch');
  }

  if (!payload['twitch_user_id']) {
    throw new Error('Missing twitch_user_id in Extension JWT');
  }

  return payload as unknown as ExtJWTPayload;
}

// Signs a short-lived handoff token (60s TTL) the drawing site uses for seamless login.
// The Extension calls POST /api/auth/ext-handoff → gets this token → opens
// https://drawing-site.com/?auth=<token> → site verifies and sets session cookie.
export async function signHandoffToken(
  payload: { twitch_user_id: string; username: string },
  sessionSecret: string
): Promise<string> {
  const key = Buffer.from(sessionSecret);
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('60s')
    .setIssuedAt()
    .sign(key);
}

export async function verifyHandoffToken(
  token: string,
  sessionSecret: string
): Promise<{ twitch_user_id: string; username: string }> {
  const key = Buffer.from(sessionSecret);
  const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });
  return payload as { twitch_user_id: string; username: string };
}
