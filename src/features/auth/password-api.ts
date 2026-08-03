/**
 * Changing the password of the employee who is already signed in (KMO-13).
 *
 * Unlike `auth-api.ts`, this one talks through the **`@/api` singleton**, and the
 * difference is deliberate. That module builds its own client to opt *out* of the
 * session-expiry latch, because its 401s do not mean what a mid-session 401 means:
 * on the way in a refusal is a wrong password, on the way out it is a token that
 * was already dead. Here a 401 means exactly what the latch is for — the token
 * this request carried is no longer accepted — so routing it through the singleton
 * is what gives KMO-13 #4 its second branch for free. The session ends, and the
 * employee lands on the login screen with KMO-11's Spanish explanation rather than
 * on a form that silently stopped working.
 *
 * A wrong current password is a 422, not a 401, so the two never collide.
 */

import { api, isApiError, type ApiClient } from '@/api';
import { es } from '@/i18n';

export type PasswordChange = {
  currentPassword: string;
  newPassword: string;
};

/**
 * Which input a refusal belongs under (#2).
 *
 * The messages are the server's own — `ams` answers from `lang/es/validation.php`
 * with `La contraseña es incorrecta.` for the current password and the
 * `Password::default()` sentences for the new one. Nothing here re-words them, for
 * the same reason the login screen shows its refusal verbatim: an employee should
 * not read one explanation on the phone and a different one on the web console for
 * the identical rejection.
 *
 * `message` is the fallback for a failure with no field in it at all — no
 * connection, a 500, a body that was not the validation envelope.
 */
export type PasswordChangeFailure = {
  readonly currentPassword?: string;
  readonly newPassword?: string;
  readonly message?: string;
};

export type PasswordApi = {
  /** Resolves on success; throws an `ApiError` on any refusal. */
  changePassword(change: PasswordChange): Promise<void>;
};

/** Relative to `/api/v1`, like every path in the app. `ams` KOL-7. */
const PASSWORD_PATH = '/user/password';

export function createPasswordApi(client: ApiClient = api): PasswordApi {
  return {
    async changePassword({ currentPassword, newPassword }: PasswordChange): Promise<void> {
      // `password_confirmation` is sent even though the screen has already
      // compared the two: the server's rule is `confirmed`, and omitting the
      // field would turn a match the employee typed correctly into a 422 about
      // a field they were never shown.
      await client.put<unknown>(PASSWORD_PATH, {
        current_password: currentPassword,
        password: newPassword,
        password_confirmation: newPassword,
      });
    },
  };
}

/**
 * Turn whatever was thrown into the messages the three fields render.
 *
 * A 422 carrying neither field is still a refusal the employee has to see, so it
 * falls through to `message` rather than resolving to an empty object that would
 * leave the form looking like nothing happened.
 */
export function passwordChangeFailureFrom(error: unknown): PasswordChangeFailure {
  if (!isApiError(error)) {
    // Something threw that was not a request failure at all. The employee still
    // gets a Spanish sentence rather than a form that appears to have done
    // nothing (Art. 5).
    return { message: es.errors.client };
  }

  const currentPassword = error.messageFor('current_password');
  const newPassword = error.messageFor('password');

  if (currentPassword !== undefined || newPassword !== undefined) {
    return {
      ...(currentPassword === undefined ? {} : { currentPassword }),
      ...(newPassword === undefined ? {} : { newPassword }),
    };
  }

  return { message: error.userMessage };
}
