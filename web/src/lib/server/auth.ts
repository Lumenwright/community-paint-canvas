// Shared auth guard helpers used across API routes.
// Each helper throws a Response on failure so routes can just `await requireSession(event)`.
import type { RequestEvent } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';
import { verifyExtJWT, type ExtJWTPayload } from './twitch-jwt.js';
import { BROADCASTER_TWITCH_ID, CRON_SECRET } from '$env/static/private';

// Require a valid drawing-site session cookie. Returns session data or throws 401.
export function requireSession(event: RequestEvent) {
  const session = event.locals.session;
  if (!session) throw error(401, 'Not authenticated');
  return session;
}

// Require a valid mod-or-broadcaster session. Throws 403 if user is not a mod.
export function requireMod(event: RequestEvent) {
  const session = requireSession(event);
  if (!session.is_mod && !session.is_broadcaster) throw error(403, 'Forbidden');
  return session;
}

// Require a broadcaster session. Throws 403 if user is not the broadcaster.
export function requireBroadcaster(event: RequestEvent) {
  const session = requireSession(event);
  if (!session.is_broadcaster) throw error(403, 'Forbidden');
  return session;
}

// Parse and verify the Extension JWT from the Authorization header.
// Returns the verified payload or throws 401.
export async function requireExtJWT(event: RequestEvent): Promise<ExtJWTPayload> {
  const authHeader = event.request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) throw error(401, 'Missing Extension JWT');
  const token = authHeader.slice(7);
  try {
    return await verifyExtJWT(token);
  } catch {
    throw error(401, 'Invalid or expired Extension JWT');
  }
}

// Check whether the cron request carries the expected CRON_SECRET header.
export function requireCronSecret(event: RequestEvent) {
  const auth = event.request.headers.get('Authorization');
  if (!auth || auth !== `Bearer ${CRON_SECRET}`) throw error(401, 'Unauthorized cron');
}

export { BROADCASTER_TWITCH_ID };
