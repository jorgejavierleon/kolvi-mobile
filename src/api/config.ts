/**
 * Where the API lives and how long the app is willing to wait for it.
 *
 * The base URL is an `EXPO_PUBLIC_` variable because Expo inlines those into the
 * bundle at build time: a Play Store build and a local dev build then point at
 * different backends without a code change and without shipping a `.env` file.
 * `.env` is gitignored; `.env.example` documents the variable.
 */

/**
 * The Android emulator reaches the host machine's `localhost` at this address —
 * `127.0.0.1` inside the emulator is the emulator itself. It is the fallback so a
 * fresh checkout talks to a locally-running `ams` without any setup, and it is
 * deliberately not a staging or production host: a build that forgot the variable
 * should fail to reach anything rather than quietly write to real attendance data.
 */
const DEV_FALLBACK_ORIGIN = 'http://10.0.2.2:8000';

/**
 * D7: the app targets `/api/v1` exclusively, never the three unversioned mark
 * routes that exist alongside it.
 */
export const API_VERSION_PREFIX = '/api/v1';

/**
 * Long enough for a punch on a bad rural connection to still land, short enough
 * that an employee holding a phone in the rain gets an answer. Beyond this the
 * request fails as `timeout`, which the offline queue (KMO-23) treats the same as
 * being offline.
 */
export const REQUEST_TIMEOUT_MS = 15_000;

/** The origin the client talks to, without a trailing slash. */
export function resolveApiOrigin(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim();

  return stripTrailingSlash(configured && configured.length > 0 ? configured : DEV_FALLBACK_ORIGIN);
}

/** The `/api/v1` base every request path is resolved against. */
export function resolveApiBaseUrl(): string {
  return `${resolveApiOrigin()}${API_VERSION_PREFIX}`;
}

function stripTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}
