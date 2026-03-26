// PKCE OAuth helpers: token exchange and user info fetch.
// Injected as a dependency so tests can stub exchangeCodeForToken without network calls.
import { TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET } from '$env/static/private';
import { PUBLIC_EBS_URL, PUBLIC_DEV_MODE } from '$env/static/public';

const DEV_MODE = PUBLIC_DEV_MODE === 'true';

export interface TwitchTokenResponse {
  access_token: string;
  token_type: string;
}

export interface TwitchUser {
  id: string;
  login: string;
  display_name: string;
}

// Exchange PKCE code for access token.
// In dev/test mode (PUBLIC_DEV_MODE=true), a code starting with 'test_code_' triggers
// a stub response — no real Twitch API call. This mirrors the Bits test_ pattern.
export async function exchangeCodeForToken(
  code: string,
  redirectUri: string
): Promise<TwitchTokenResponse> {
  if (DEV_MODE && code.startsWith('test_code_')) {
    // Stub: extract a fake user ID encoded after the prefix, e.g. 'test_code_user_1'
    return { access_token: `stub_token_${code.slice(10)}`, token_type: 'bearer' };
  }

  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: TWITCH_CLIENT_ID,
      client_secret: TWITCH_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri
    })
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`);
  return res.json();
}

export async function fetchTwitchUser(accessToken: string): Promise<TwitchUser> {
  if (DEV_MODE && accessToken.startsWith('stub_token_')) {
    const userId = accessToken.slice(11); // 'stub_token_'.length = 11
    return { id: userId, login: userId, display_name: userId };
  }

  const res = await fetch('https://api.twitch.tv/helix/users', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Client-Id': TWITCH_CLIENT_ID
    }
  });
  if (!res.ok) throw new Error(`Helix users failed: ${res.status}`);
  const { data } = await res.json();
  return data[0];
}

// Redirect URIs must match what's registered in the Twitch Developer Console.
export const DRAWING_REDIRECT_URI = `${PUBLIC_EBS_URL}/api/auth/callback`;
export const MOD_REDIRECT_URI = `${PUBLIC_EBS_URL}/api/auth/mod-callback`;
