import { ApiError, createApiClient } from '@/api';
import { es } from '@/i18n';

import { authFailureFrom, createAuthApi, type AuthFailure } from './auth-api';

const ORIGIN = 'https://ams.test';

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
  return createAuthApi(createApiClient({ baseUrl: ORIGIN, fetch: fetchImpl }));
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
  // The endpoint is outside /api/v1 — the versioned base URL would 404 here.
  it('posts the credentials and the device name to the unversioned endpoint', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(respondWith(200, { token: 'tok_abc' }));

    const token = await apiWith(fetchImpl).issueToken(
      { email: 'employee@example.com', password: 'admin' },
      'Kolvi android 9a3f',
    );

    expect(token).toBe('tok_abc');

    const { url, init } = lastRequest(fetchImpl);
    expect(url).toBe('https://ams.test/api/sanctum/token');
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
    expect(url).toBe('https://ams.test/api/user');
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

  it('passes the throttle message through as a rejection', () => {
    const throttled = 'Demasiados intentos de acceso. Inténtelo de nuevo en 45 segundos.';
    const error = new ApiError({ kind: 'client', status: 429, serverMessage: throttled });

    expect(authFailureFrom(error)).toEqual({ kind: 'rejected', message: throttled });
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
