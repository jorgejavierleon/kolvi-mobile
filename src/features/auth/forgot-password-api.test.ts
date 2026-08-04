import { ApiError, createApiClient } from '@/api';
import { es, tooManyAttempts } from '@/i18n';

import { createForgotPasswordApi, resetRequestFailureFrom } from './forgot-password-api';

const BASE_URL = 'https://ams.test/api/v1';

function respondWith(status: number, body?: unknown, headers?: Record<string, string>): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
    headers: { get: (name: string) => headers?.[name] ?? null },
  } as unknown as Response;
}

function apiWith(fetchImpl: jest.Mock) {
  return createForgotPasswordApi(createApiClient({ baseUrl: BASE_URL, fetch: fetchImpl }));
}

function lastRequest(fetchImpl: jest.Mock): { url: string; init: RequestInit } {
  const call = fetchImpl.mock.calls.at(-1);
  return { url: call?.[0] as string, init: (call?.[1] ?? {}) as RequestInit };
}

describe('requestReset', () => {
  it('posts the address to the versioned endpoint', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(respondWith(204));

    await apiWith(fetchImpl).requestReset('empleado@example.com');

    const { url, init } = lastRequest(fetchImpl);
    expect(url).toBe('https://ams.test/api/v1/forgot-password');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ email: 'empleado@example.com' });
  });

  it('carries no Authorization header', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(respondWith(204));

    await apiWith(fetchImpl).requestReset('empleado@example.com');

    // The employee is here because they cannot get a token. A stale one from a
    // previous session must not decide whether this request is accepted.
    const headers = (lastRequest(fetchImpl).init.headers ?? {}) as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  // AC#2, from this side. The endpoint answers 204 whether or not the address has
  // an account, and this module must not develop an opinion about which it was —
  // there is nothing in a 204 to have an opinion about.
  it('resolves the same way for an address that has an account and one that does not', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(respondWith(204));
    const api = apiWith(fetchImpl);

    await expect(api.requestReset('empleado@example.com')).resolves.toBeUndefined();
    await expect(api.requestReset('nadie@example.com')).resolves.toBeUndefined();
  });

  it('throws rather than resolving when the server refuses', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      respondWith(422, {
        message: 'El campo correo electrónico no es válido.',
        errors: { email: ['El campo correo electrónico no es válido.'] },
      }),
    );

    await expect(apiWith(fetchImpl).requestReset('no-es-un-correo')).rejects.toBeInstanceOf(
      ApiError,
    );
  });
});

describe('resetRequestFailureFrom', () => {
  it('reads a lost connection as one, so a retry can be offered', () => {
    const failure = resetRequestFailureFrom(new ApiError({ kind: 'network' }));

    expect(failure.kind).toBe('connectivity');
    expect(failure.message).toBe(es.errors.network);
  });

  // AC#5. `ams` throttles this endpoint through Laravel's own ThrottleRequests,
  // whose body is the untranslated `Too Many Attempts.` — none of which may reach
  // an employee (Art. 5).
  it('turns a 429 into the Spanish wait, with the interval the server named', () => {
    const failure = resetRequestFailureFrom(
      new ApiError({
        kind: 'rateLimited',
        status: 429,
        serverMessage: 'Too Many Attempts.',
        retryAfterSeconds: 45,
      }),
    );

    expect(failure.kind).toBe('throttled');
    expect(failure.retryAfterSeconds).toBe(45);
    expect(failure.message).toBe(tooManyAttempts(45));
    expect(failure.message).not.toContain('Too Many Attempts');
  });

  it('names no interval when the server did not send one', () => {
    const failure = resetRequestFailureFrom(new ApiError({ kind: 'rateLimited', status: 429 }));

    expect(failure.kind).toBe('throttled');
    expect(failure.retryAfterSeconds).toBeUndefined();
    expect(failure.message).toBe(es.errors.rateLimited);
  });

  it('shows the server sentence for a rejected address', () => {
    const failure = resetRequestFailureFrom(
      new ApiError({
        kind: 'validation',
        status: 422,
        serverMessage: 'El campo correo electrónico no es válido.',
        fieldErrors: { email: ['El campo correo electrónico no es válido.'] },
      }),
    );

    expect(failure.kind).toBe('rejected');
    expect(failure.message).toBe('El campo correo electrónico no es válido.');
  });

  it('still produces a Spanish sentence for something that was not a request failure', () => {
    expect(resetRequestFailureFrom(new Error('boom')).message).toBe(es.errors.client);
  });
});
