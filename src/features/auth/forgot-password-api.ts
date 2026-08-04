/**
 * Asking the server to mail a password-reset link (KMO-14).
 *
 * Like `auth-api.ts` this builds its **own** client rather than using the `@/api`
 * singleton, and for that module's reason: the singleton latches any 401 into
 * "your session ended" and announces it on the login screen. Nobody on this
 * screen has a session to lose — they are here precisely because they cannot get
 * one — so a stray 401 must not tell them otherwise.
 *
 * The endpoint answers **204 whatever happened**. An address with an account, an
 * address without one, and a second request the server's own broker declined all
 * produce the identical response, because a difference between them is a way to
 * test whether a given person works here (#2). That is why nothing in this module
 * inspects the success path: there is nothing in it to inspect, by design.
 */

import { createApiClient, resolveApiBaseUrl, type ApiClient } from '@/api';

import { authFailureFrom, type AuthFailure } from './auth-api';

export type ForgotPasswordApi = {
  /** Resolves once the server has taken the request; throws an `ApiError` otherwise. */
  requestReset(email: string): Promise<void>;
};

/** Relative to `/api/v1`, like every path in the app. `ams` KOL-9. */
const FORGOT_PASSWORD_PATH = '/forgot-password';

export function createForgotPasswordApi(client?: ApiClient): ForgotPasswordApi {
  const http = client ?? createApiClient({ baseUrl: resolveApiBaseUrl() });

  return {
    async requestReset(email: string): Promise<void> {
      await http.post<unknown>(FORGOT_PASSWORD_PATH, { email });
    },
  };
}

/**
 * Why the request did not go through.
 *
 * `authFailureFrom` is reused rather than reimplemented: the three-way split it
 * makes — the request never arrived, the server said *not yet*, the server said
 * no — is the same split this screen needs, down to which one may offer a retry.
 * A second copy would be a second thing to keep in step with `ams`'s error
 * shapes, and the login screen is where those shapes are already proven.
 *
 * The refusals that reach here are narrow: a 422 on `errors.email` for an address
 * that is not an address, a 429 from the limiter (#5), or no connection at all.
 * An unknown address is not among them — that is a 204.
 */
export function resetRequestFailureFrom(error: unknown): AuthFailure {
  return authFailureFrom(error);
}
