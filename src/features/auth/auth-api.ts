/**
 * The two calls a sign-in makes, and the one way it can fail.
 *
 * Both endpoints sit **outside** `/api/v1`: `ams` mounts `POST /api/sanctum/token`
 * publicly and `GET /api/user` behind `auth:sanctum`, neither under the versioned
 * prefix the rest of the app talks to. So this module binds its own client to the
 * bare origin instead of using the `@/api` singleton — which also keeps a rejected
 * login out of the singleton's session-expiry latch, where a 401 means "your
 * session ended" rather than "that password is wrong".
 */

import {
  ApiError,
  createApiClient,
  isApiError,
  resolveApiOrigin,
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
};

const TOKEN_PATH = '/api/sanctum/token';
const USER_PATH = '/api/user';

export function createAuthApi(client?: ApiClient): AuthApi {
  const http = client ?? createApiClient({ baseUrl: resolveApiOrigin() });

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
