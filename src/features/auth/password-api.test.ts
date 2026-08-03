import { ApiError, createApiClient } from '@/api';
import { es } from '@/i18n';

import { createPasswordApi, passwordChangeFailureFrom } from './password-api';

const BASE_URL = 'https://ams.test/api/v1';

/** The sentence `ams` actually returns, from `lang/es/validation.php`. */
const WRONG_CURRENT = 'La contraseña es incorrecta.';
const POLICY_FAILURE = 'El campo contraseña debe contener al menos un símbolo.';

function respondWith(status: number, body?: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  } as unknown as Response;
}

function apiWith(fetchImpl: jest.Mock) {
  return createPasswordApi(createApiClient({ baseUrl: BASE_URL, fetch: fetchImpl }));
}

function lastRequest(fetchImpl: jest.Mock): { url: string; init: RequestInit } {
  const call = fetchImpl.mock.calls.at(-1);
  return { url: call?.[0] as string, init: (call?.[1] ?? {}) as RequestInit };
}

describe('changePassword', () => {
  it('puts both passwords to the versioned endpoint', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(respondWith(204));

    await apiWith(fetchImpl).changePassword({
      currentPassword: 'la-vieja',
      newPassword: 'Marcaje-2026!',
    });

    const { url, init } = lastRequest(fetchImpl);
    expect(url).toBe('https://ams.test/api/v1/user/password');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(String(init.body))).toEqual({
      current_password: 'la-vieja',
      password: 'Marcaje-2026!',
      password_confirmation: 'Marcaje-2026!',
    });
  });

  it('sends the confirmation the server rule requires, even though the screen already matched them', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(respondWith(204));

    await apiWith(fetchImpl).changePassword({ currentPassword: 'x', newPassword: 'Marcaje-2026!' });

    const body = JSON.parse(String(lastRequest(fetchImpl).init.body)) as Record<string, unknown>;

    // `confirmed` fails on a missing field, not merely a mismatched one — so
    // omitting this would 422 a change the employee typed correctly.
    expect(body.password_confirmation).toBe('Marcaje-2026!');
  });

  it('throws the 422 rather than resolving, so the screen never reports a change that did not happen', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      respondWith(422, {
        message: WRONG_CURRENT,
        errors: { current_password: [WRONG_CURRENT] },
      }),
    );

    await expect(
      apiWith(fetchImpl).changePassword({ currentPassword: 'nope', newPassword: 'Marcaje-2026!' }),
    ).rejects.toBeInstanceOf(ApiError);
  });
});

describe('passwordChangeFailureFrom', () => {
  it('puts the wrong-current-password message under the current field (#2)', () => {
    const error = new ApiError({
      kind: 'validation',
      status: 422,
      serverMessage: WRONG_CURRENT,
      fieldErrors: { current_password: [WRONG_CURRENT] },
    });

    expect(passwordChangeFailureFrom(error)).toEqual({ currentPassword: WRONG_CURRENT });
  });

  it('puts a policy failure under the new-password field (#2)', () => {
    const error = new ApiError({
      kind: 'validation',
      status: 422,
      serverMessage: 'Los datos proporcionados no son válidos.',
      fieldErrors: { password: [POLICY_FAILURE] },
    });

    expect(passwordChangeFailureFrom(error)).toEqual({ newPassword: POLICY_FAILURE });
  });

  it('carries the server sentence verbatim rather than re-wording it', () => {
    const error = new ApiError({
      kind: 'validation',
      status: 422,
      fieldErrors: { current_password: [WRONG_CURRENT] },
    });

    // The same refusal has to read identically on the phone and on the web
    // console. A catalogue entry here would be a second wording for one event.
    const messages = Object.values(es.auth.changePassword);
    expect(messages).not.toContain(WRONG_CURRENT);
    expect(passwordChangeFailureFrom(error).currentPassword).toBe(WRONG_CURRENT);
  });

  it('splits a 422 that rejected both fields at once', () => {
    const error = new ApiError({
      kind: 'validation',
      status: 422,
      fieldErrors: { current_password: [WRONG_CURRENT], password: [POLICY_FAILURE] },
    });

    expect(passwordChangeFailureFrom(error)).toEqual({
      currentPassword: WRONG_CURRENT,
      newPassword: POLICY_FAILURE,
    });
  });

  it('falls back to a whole-form message when the refusal names no field', () => {
    const error = new ApiError({ kind: 'server', status: 500 });

    expect(passwordChangeFailureFrom(error)).toEqual({ message: es.errors.server });
  });

  it('reports a lost connection as a message rather than silently doing nothing', () => {
    const error = new ApiError({ kind: 'network' });

    expect(passwordChangeFailureFrom(error).message).toBe(es.errors.network);
  });

  it('gives a Spanish sentence for something that was not a request failure at all', () => {
    expect(passwordChangeFailureFrom(new Error('boom'))).toEqual({ message: es.errors.client });
  });
});
