import { log } from "../index";

// Thumbtack OAuth2 configuration
const THUMBTACK_AUTH_URL = "https://auth.thumbtack.com/oauth2/auth";
const THUMBTACK_TOKEN_URL = "https://auth.thumbtack.com/oauth2/token";
const THUMBTACK_AUDIENCE = "urn:partner-api";

interface ThumbtackTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

/**
 * Build the Thumbtack OAuth authorization URL that redirects the user to consent.
 */
export function buildAuthorizationUrl(
  clientId: string,
  redirectUri: string,
  scopes: string[],
  state: string,
): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: scopes.join(" "),
    state,
    audience: THUMBTACK_AUDIENCE,
  });

  return `${THUMBTACK_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange an authorization code for access + refresh tokens.
 */
export async function exchangeCodeForTokens(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<ThumbtackTokenResponse> {
  const response = await fetch(THUMBTACK_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      audience: THUMBTACK_AUDIENCE,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    log(`Thumbtack token exchange failed: ${response.status} ${errorBody}`, "thumbtack");
    throw new Error(`Thumbtack token exchange failed: ${response.status}`);
  }

  return response.json() as Promise<ThumbtackTokenResponse>;
}

/**
 * Refresh an expired access token using a refresh token.
 */
export async function refreshAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<ThumbtackTokenResponse> {
  const response = await fetch(THUMBTACK_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      audience: THUMBTACK_AUDIENCE,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    log(`Thumbtack token refresh failed: ${response.status} ${errorBody}`, "thumbtack");
    throw new Error(`Thumbtack token refresh failed: ${response.status}`);
  }

  return response.json() as Promise<ThumbtackTokenResponse>;
}
