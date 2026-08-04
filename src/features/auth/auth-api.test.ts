import { ApiError, createApiClient } from '@/api';
import { es, tooManyAttempts } from '@/i18n';

import { authFailureFrom, createAuthApi, type AuthFailure } from './auth-api';

const BASE_URL = 'https://ams.test/api/v1';

/** The two sentences `ams` actually returns, from `lang/es/auth.php`. */
const CREDENTIALS_REJECTED = 'Estas credenciales no coinciden con nuestros registros.';
const ACCOUNT_INACTIVE = 'Esta cuenta está inactiva.';

function respondWith(status: number, body?: unknown, raw?: string): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => raw ?? (body === undefined ? '' : JSON.stringify(body)),
  } as unknown as Response;
}

function apiWith(fetchImpl: jest.Mock) {
  return createAuthApi(createApiClient({ baseUrl: BASE_URL, fetch: fetchImpl }));
}

function lastRequest(fetchImpl: jest.Mock): { url: string; init: RequestInit } {
  const call = fetchImpl.mock.calls.at(-1);
  return { url: call?.[0] as string, init: (call?.[1] ?? {}) as RequestInit };
}

/** Laravel's validation envelope: the generic summary plus the specific field. */
function rejection(message: string) {
  return { message, errors: { email: [message] } };
}

describe('issueToken', () => {
  it('posts the credentials and the device name to the versioned token endpoint', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(respondWith(200, { token: 'tok_abc' }));

    const token = await apiWith(fetchImpl).issueToken(
      { email: 'employee@example.com', password: 'admin' },
      'Kolvi android 9a3f',
    );

    expect(token).toBe('tok_abc');

    const { url, init } = lastRequest(fetchImpl);
    expect(url).toBe('https://ams.test/api/v1/tokens');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({
      email: 'employee@example.com',
      password: 'admin',
      device_name: 'Kolvi android 9a3f',
    });
  });

  it('sends no bearer token, since the caller has none yet', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(respondWith(200, { token: 'tok_abc' }));

    await apiWith(fetchImpl).issueToken({ email: 'e@example.com', password: 'p' }, 'device');

    const headers = lastRequest(fetchImpl).init.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it.each<[string, unknown]>([
    ['no token field', { ok: true }],
    ['an empty token', { token: '' }],
    ['a non-string token', { token: 42 }],
  ])('refuses a 200 carrying %s', async (_label, body) => {
    const fetchImpl = jest.fn().mockResolvedValue(respondWith(200, body));

    await expect(
      apiWith(fetchImpl).issueToken({ email: 'e@example.com', password: 'p' }, 'device'),
    ).rejects.toMatchObject({ kind: 'malformed' });
  });
});

describe('fetchSessionUser', () => {
  it('reads the user with the freshly issued token', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(respondWith(200, { id: 3, name: 'Empleado Demo', email: 'e@ams.cl' }));

    const user = await apiWith(fetchImpl).fetchSessionUser('tok_abc');

    expect(user.name).toBe('Empleado Demo');

    const { url, init } = lastRequest(fetchImpl);
    expect(url).toBe('https://ams.test/api/v1/user');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok_abc');
  });

  // #8, end to end through the real client: the bytes below are what a locally
  // running `ams` returns after KOL-5, and every permission in them has to come
  // out the other side as something `can()` can be asked about.
  it('reads the permissions out of the payload ams returns after KOL-5', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      respondWith(200, {
        id: 5,
        name: 'Empleado Demo',
        first_name: 'Empleado',
        last_name: 'Demo',
        rut: '21437581-8',
        email: 'employee@example.com',
        avatar: null,
        permissions: [
          'RequestOwn:Leave',
          'ViewOwn:Leave',
          'CancelOwn:Leave',
          'ClockOwn:Mark',
          'ViewOwn:Mark',
          'ViewOwn:Workday',
          'ReviewOwn:MarkModification',
          'ViewOwn:Document',
          'SignOwn:Document',
        ],
      }),
    );

    const user = await apiWith(fetchImpl).fetchSessionUser('tok_abc');

    expect(user.permissions.has('ClockOwn:Mark')).toBe(true);
    expect(user.permissions.size).toBe(9);
    expect(user.rut).toBe('21437581-8');
  });

  it('refuses a body that is not a user', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(respondWith(200, { id: 3 }));

    await expect(apiWith(fetchImpl).fetchSessionUser('tok_abc')).rejects.toMatchObject({
      kind: 'malformed',
    });
  });
});

// KMO-12 #1, against the contract `ams` KOL-6 shipped.
describe('revokeToken', () => {
  it('deletes the current token at the versioned path, carrying the token being revoked', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(respondWith(204));

    const revoked = await apiWith(fetchImpl).revokeToken('tok_abc');

    expect(revoked).toBe(true);

    const { url, init } = lastRequest(fetchImpl);
    expect(url).toBe('https://ams.test/api/v1/tokens/current');
    expect(init.method).toBe('DELETE');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok_abc');
  });

  // A token the server already refuses cannot be used by anyone, so there is
  // nothing to warn the employee about.
  it('counts a 401 as revoked, because the token is already dead', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(respondWith(401, { message: 'Unauthenticated.' }));

    await expect(apiWith(fetchImpl).revokeToken('tok_abc')).resolves.toBe(true);
  });

  it.each<[string, () => Response | Promise<never>]>([
    ['no connection', () => Promise.reject(new TypeError('Network request failed'))],
    ['a 404 from a server without the route', () => respondWith(404)],
    ['a server error', () => respondWith(500, undefined, '<html>502</html>')],
  ])('reports the token as still live on %s', async (_label, outcome) => {
    const fetchImpl = jest.fn().mockImplementation(outcome);

    await expect(apiWith(fetchImpl).revokeToken('tok_abc')).resolves.toBe(false);
  });

  // The caller is signing the employee out and has nowhere to put an exception:
  // a throw here would leave a token in the keystore on the one path built to
  // remove it.
  it('never throws, whatever the transport did', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error('boom'));

    await expect(apiWith(fetchImpl).revokeToken('tok_abc')).resolves.toBe(false);
  });
});

describe('authFailureFrom', () => {
  // #4 — the criterion. Both rejections are 422s with the same shape; only the
  // sentence differs, and the app hands it through untouched rather than
  // classifying it.
  it('shows the wrong-credentials sentence the server sent', () => {
    const error = new ApiError({
      kind: 'validation',
      status: 422,
      serverMessage: CREDENTIALS_REJECTED,
      fieldErrors: { email: [CREDENTIALS_REJECTED] },
    });

    expect(authFailureFrom(error)).toEqual({
      kind: 'rejected',
      message: CREDENTIALS_REJECTED,
    });
  });

  it('shows the inactive-account sentence the server sent', () => {
    const error = new ApiError({
      kind: 'validation',
      status: 422,
      serverMessage: ACCOUNT_INACTIVE,
      fieldErrors: { email: [ACCOUNT_INACTIVE] },
    });

    expect(authFailureFrom(error)).toEqual({ kind: 'rejected', message: ACCOUNT_INACTIVE });
  });

  it('keeps the two rejections distinguishable end to end', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(respondWith(422, rejection(CREDENTIALS_REJECTED)));
    const authApi = apiWith(fetchImpl);
    const attempt = async (): Promise<AuthFailure> =>
      authApi.issueToken({ email: 'e@example.com', password: 'p' }, 'device').then(
        () => {
          throw new Error('the login was expected to be rejected');
        },
        (error: unknown) => authFailureFrom(error),
      );

    const wrongPassword = await attempt();

    fetchImpl.mockResolvedValue(respondWith(422, rejection(ACCOUNT_INACTIVE)));
    const inactive = await attempt();

    expect(wrongPassword.message).toBe(CREDENTIALS_REJECTED);
    expect(inactive.message).toBe(ACCOUNT_INACTIVE);
    expect(wrongPassword.message).not.toBe(inactive.message);
  });

  it('prefers the field message over the envelope summary', () => {
    const error = new ApiError({
      kind: 'validation',
      status: 422,
      serverMessage: 'Los datos proporcionados no son válidos.',
      fieldErrors: { email: [CREDENTIALS_REJECTED] },
    });

    expect(authFailureFrom(error).message).toBe(CREDENTIALS_REJECTED);
  });

  // KMO-50. This replaces a test that asserted the throttle message was passed
  // through as a rejection, on the assumption that `ams` sent Spanish. It does
  // not: KOL-8 throttles through Laravel's own middleware, whose body is the
  // untranslated `Too Many Attempts.` — so the old test encoded putting English
  // in front of an employee, which Art. 5 does not allow.
  it('reports a throttle as its own kind, in Spanish, ignoring what the server said', () => {
    const error = new ApiError({
      kind: 'rateLimited',
      status: 429,
      serverMessage: 'Too Many Attempts.',
      retryAfterSeconds: 45,
    });

    expect(authFailureFrom(error)).toEqual({
      kind: 'throttled',
      message: tooManyAttempts(45),
      retryAfterSeconds: 45,
    });
  });

  it('still reports a throttle when the server did not say how long', () => {
    const error = new ApiError({ kind: 'rateLimited', status: 429 });

    // No `retryAfterSeconds` key at all rather than a zero: the screen must not
    // be told to wait an interval the server never named.
    expect(authFailureFrom(error)).toEqual({
      kind: 'throttled',
      message: es.errors.rateLimited,
    });
  });

  it('never lets the server throttle sentence reach the screen', () => {
    const error = new ApiError({
      kind: 'rateLimited',
      status: 429,
      serverMessage: 'Too Many Attempts.',
    });

    expect(authFailureFrom(error).message).not.toContain('Too Many');
  });

  // #5 — a failure that never reached the server is a different kind of failure,
  // and the screen offers a retry only for this one.
  it.each<['network' | 'timeout', string]>([
    ['network', es.errors.network],
    ['timeout', es.errors.timeout],
  ])('reports a %s failure as connectivity', (kind, message) => {
    expect(authFailureFrom(new ApiError({ kind }))).toEqual({ kind: 'connectivity', message });
  });

  it('never reports a rejection as connectivity', () => {
    const error = new ApiError({ kind: 'server', status: 500 });

    expect(authFailureFrom(error)).toEqual({ kind: 'rejected', message: es.errors.server });
  });

  it('falls back to catalogue copy for something that is not an ApiError', () => {
    expect(authFailureFrom(new TypeError('undefined is not a function'))).toEqual({
      kind: 'rejected',
      message: es.errors.client,
    });
  });
});
