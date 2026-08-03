/**
 * The calls that begin and end a session, and the one way a sign-in can fail.
 *
 * All three live under `/api/v1` like everything else the app talks to, so this
 * module resolves the same base URL the `@/api` singleton does — but it still
 * builds its **own client** rather than using that singleton, and the reason is
 * the session-expiry latch.
 *
 * The singleton turns any 401 into "your session ended" and shows it on the login
 * screen. That is right for a request made *during* a session and wrong for all
 * three of these: on the way in a refusal means "that password is wrong", on the
 * way out it means "the token was already dead", and a restore that 401s is
 * handled by `SessionProvider` itself, which knows whether there was a session to
 * lose. A second client is what keeps those three off the announcement.
 */

import {
  ApiError,
  createApiClient,
  isApiError,
  resolveApiBaseUrl,
  type ApiClient,
  type RequestOptions,
} from '@/api';
import { es } from '@/i18n';

import { parseSessionUser, type SessionUser } from './session-user';

export type Credentials = {
  email: string;
  password: string;
};

/**
 * Why a sign-in did not happen, in the only two flavours a screen treats
 * differently (AC#4, AC#5).
 *
 * `rejected` — the server answered and said no. `message` is the server's own
 * sentence, which is what keeps "these credentials do not match" and "this account
 * is inactive" distinct without the app ever inspecting Spanish: both arrive as a
 * 422 under `errors.email` and differ only in their wording.
 *
 * `connectivity` — the request never got an answer, so nothing was decided and
 * pressing the same button again is a reasonable thing to offer.
 */
export type AuthFailure = {
  readonly kind: 'rejected' | 'connectivity';
  readonly message: string;
};

export type AuthApi = {
  /** The plain-text Sanctum token. `ams` revokes the previous token of this name. */
  issueToken(credentials: Credentials, deviceName: string): Promise<string>;
  /**
   * The employee behind a token. Takes the token explicitly rather than reading a
   * store, because the first call happens before the token has been stored.
   */
  fetchSessionUser(token: string): Promise<SessionUser>;
  /**
   * Kill this device's token on the server, and report whether it is dead.
   *
   * Never throws: a sign-out that fails is still a sign-out, and the caller's next
   * move is the same either way. `false` is what makes the app say the token stays
   * active until the device reconnects, so it has to mean exactly that.
   */
  revokeToken(token: string): Promise<boolean>;
};

// Relative to `/api/v1`, like every other path in the app. `ams` KOL-6 moved the
// login and user endpoints under the prefix and added the revocation one there,
// so there is no longer a path in this app that spells its own version.
const TOKEN_PATH = '/tokens';
const USER_PATH = '/user';
/** PRD A2. Revokes the token the request authenticates with, and nothing else. */
const REVOKE_PATH = '/tokens/current';

export function createAuthApi(client?: ApiClient): AuthApi {
  const http = client ?? createApiClient({ baseUrl: resolveApiBaseUrl() });

  return {
    async issueToken(credentials: Credentials, deviceName: string): Promise<string> {
      const response = await http.post<unknown>(TOKEN_PATH, {
        email: credentials.email,
        password: credentials.password,
        device_name: deviceName,
      });

      const token = readToken(response);

      if (token === null) {
        // A 2xx with no usable token: the app must not report a successful login
        // it cannot act on.
        throw new ApiError({ kind: 'malformed' });
      }

      return token;
    },

    async fetchSessionUser(token: string): Promise<SessionUser> {
      const options: RequestOptions = { headers: { Authorization: `Bearer ${token}` } };
      const user = parseSessionUser(await http.get<unknown>(USER_PATH, options));

      if (user === null) {
        throw new ApiError({ kind: 'malformed' });
      }

      return user;
    },

    async revokeToken(token: string): Promise<boolean> {
      try {
        await http.del<unknown>(REVOKE_PATH, {
          headers: { Authorization: `Bearer ${token}` },
        });

        return true;
      } catch (error) {
        // A 401 is the one refusal that means the job is done: the server will not
        // accept this token, so there is nothing left to revoke and telling the
        // employee otherwise would be a warning about a credential that cannot be
        // used. Everything else — no connection, a timeout, a 404 from a build
        // pointed at a server without this route, a 500 — leaves a live token
        // behind, and the employee is told so.
        return isApiError(error) && error.kind === 'unauthorized';
      }
    },
  };
}

/**
 * Turn whatever was thrown into the sentence the employee reads.
 *
 * The field message wins over the body's top-level `message` because Laravel's
 * validation envelope repeats a generic summary there, while `errors.email` holds
 * the specific reason the login was refused.
 */
export function authFailureFrom(error: unknown): AuthFailure {
  if (!isApiError(error)) {
    return { kind: 'rejected', message: es.errors.client };
  }

  if (error.isConnectivityFailure) {
    return { kind: 'connectivity', message: error.userMessage };
  }

  return { kind: 'rejected', message: error.messageFor('email') ?? error.userMessage };
}

function readToken(response: unknown): string | null {
  if (typeof response !== 'object' || response === null) {
    return null;
  }

  const { token } = response as { token?: unknown };

  return typeof token === 'string' && token.length > 0 ? token : null;
}
