import { es } from '@/i18n';

import { api, configureApi, createApiClient, type ApiClientOptions } from './client';
import { REQUEST_TIMEOUT_MS } from './config';
import { ApiError, isApiError } from './errors';

const BASE_URL = 'https://ams.test/api/v1';

/**
 * A response stand-in. Only `ok`, `status` and `text()` are ever read, and the
 * real `Response` is not constructible in every jest environment.
 */
function respondWith(status: number, body?: unknown, raw?: string): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => raw ?? (body === undefined ? '' : JSON.stringify(body)),
  } as unknown as Response;
}

function clientWith(fetchImpl: jest.Mock, options: Omit<ApiClientOptions, 'fetch'> = {}) {
  return createApiClient({ baseUrl: BASE_URL, fetch: fetchImpl, ...options });
}

function lastRequest(fetchImpl: jest.Mock): { url: string; init: RequestInit } {
  const call = fetchImpl.mock.calls.at(-1);
  return { url: call?.[0] as string, init: (call?.[1] ?? {}) as RequestInit };
}

function headerOf(init: RequestInit, name: string): string | undefined {
  return (init.headers as Record<string, string> | undefined)?.[name];
}

describe('the request the client sends', () => {
  // #1 — base URL, token, JSON headers. Every one of these would be a thing a
  // screen could forget if screens were allowed to call fetch.
  it('resolves a path against the versioned base URL', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(respondWith(200, { ok: true }));

    await clientWith(fetchImpl).get('/me/today');

    expect(lastRequest(fetchImpl).url).toBe('https://ams.test/api/v1/me/today');
  });

  it('accepts a path without a leading slash rather than producing a broken URL', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(respondWith(200, {}));

    await clientWith(fetchImpl).get('me/today');

    expect(lastRequest(fetchImpl).url).toBe('https://ams.test/api/v1/me/today');
  });

  it('attaches the Sanctum bearer token from the injected provider', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(respondWith(200, {}));

    await clientWith(fetchImpl, { getToken: () => 'tok_123' }).get('/me/today');

    expect(headerOf(lastRequest(fetchImpl).init, 'Authorization')).toBe('Bearer tok_123');
  });

  it('awaits an async token provider, since SecureStore is async', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(respondWith(200, {}));

    await clientWith(fetchImpl, { getToken: async () => 'tok_async' }).get('/me/today');

    expect(headerOf(lastRequest(fetchImpl).init, 'Authorization')).toBe('Bearer tok_async');
  });

  // The login call itself is unauthenticated; sending `Bearer null` would make
  // it a malformed request rather than an anonymous one.
  it('sends no Authorization header when there is no token', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(respondWith(200, {}));

    await clientWith(fetchImpl, { getToken: () => null }).get('/me/today');

    expect(headerOf(lastRequest(fetchImpl).init, 'Authorization')).toBeUndefined();
  });

  it('asks for JSON, and declares JSON only when it is sending a body', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(respondWith(200, {}));
    const client = clientWith(fetchImpl);

    await client.get('/me/today');
    expect(headerOf(lastRequest(fetchImpl).init, 'Accept')).toBe('application/json');
    expect(headerOf(lastRequest(fetchImpl).init, 'Content-Type')).toBeUndefined();

    await client.post('/marks', { type: 'in' });
    expect(headerOf(lastRequest(fetchImpl).init, 'Content-Type')).toBe('application/json');
    expect(lastRequest(fetchImpl).init.body).toBe('{"type":"in"}');
  });

  it('sends each verb with its own method', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(respondWith(200, {}));
    const client = clientWith(fetchImpl);

    await client.get('/a');
    await client.post('/a', {});
    await client.put('/a', {});
    await client.patch('/a', {});
    await client.del('/a');

    expect(fetchImpl.mock.calls.map((call) => (call[1] as RequestInit).method)).toEqual([
      'GET',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
    ]);
  });

  it('builds a query string and drops undefined values instead of sending them empty', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(respondWith(200, {}));

    await clientWith(fetchImpl).get('/me/workdays', {
      query: { from: '2026-08-01', page: 2, pending: true, to: undefined },
    });

    expect(lastRequest(fetchImpl).url).toBe(
      'https://ams.test/api/v1/me/workdays?from=2026-08-01&page=2&pending=true',
    );
  });
});

describe('reading the response', () => {
  it('returns the parsed body, typed by the caller', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(respondWith(200, { worked_hours: 32.5 }));

    const body = await clientWith(fetchImpl).get<{ worked_hours: number }>('/me/today');

    expect(body.worked_hours).toBe(32.5);
  });

  it('returns undefined for a 204, which is what a revocation endpoint answers', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(respondWith(204));

    await expect(clientWith(fetchImpl).del('/tokens/current')).resolves.toBeUndefined();
  });

  it('reports a 2xx that is not the promised JSON as malformed, in Spanish', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(respondWith(200, undefined, '<html>hi</html>'));

    await expect(clientWith(fetchImpl).get('/me/today')).rejects.toMatchObject({
      kind: 'malformed',
      userMessage: es.errors.malformed,
    });
  });

  // A 500 from a proxy is HTML. The status already carries the meaning, so
  // failing to parse the body must not replace it with a parse error.
  it('keeps the status meaning when a failed response body is not JSON', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(respondWith(502, undefined, '<html>502 Bad Gateway</html>'));

    await expect(clientWith(fetchImpl).get('/me/today')).rejects.toMatchObject({
      kind: 'server',
      status: 502,
      userMessage: es.errors.server,
    });
  });
});

// #2 — the round trip through the whole client, not just the parser: what the
// app sends is byte-identical on the wire, and what comes back is byte-identical
// in the app. Nothing in between is allowed to normalise a wall-clock reading.
describe('naive datetimes across a request', () => {
  const DEVICE_DATETIME = '2026-09-06 00:30:00';

  it('survives the round trip unchanged, including a DST gap reading', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(respondWith(201, { date_time: DEVICE_DATETIME, type: 'in' }));

    const created = await clientWith(fetchImpl).post<{ date_time: string }>('/marks', {
      device_datetime: DEVICE_DATETIME,
    });

    expect(lastRequest(fetchImpl).init.body).toBe(`{"device_datetime":"${DEVICE_DATETIME}"}`);
    expect(created.date_time).toBe(DEVICE_DATETIME);
  });

  it('leaves nested and repeated datetime fields alone too', async () => {
    const payload = {
      date: '2026-04-05',
      shift: { start_time: '08:00:00', end_time: '17:30:00' },
      marks: [{ date_time: '2026-04-05 00:30:00' }, { date_time: '2026-04-05 09:00:00' }],
    };
    const fetchImpl = jest.fn().mockResolvedValue(respondWith(200, payload));

    await expect(clientWith(fetchImpl).get('/me/today')).resolves.toEqual(payload);
  });
});

describe('session expiry', () => {
  // #4 — opening the app fires several requests at once. If the token has gone
  // they all come back 401 together, and the employee must get one sign-out and
  // one login prompt, not three.
  it('fires the expiry path exactly once across concurrent 401s', async () => {
    const onSessionExpired = jest.fn();
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(respondWith(401, { message: 'Unauthenticated.' }));
    const client = clientWith(fetchImpl, { onSessionExpired });

    const results = await Promise.allSettled([
      client.get('/me/today'),
      client.get('/me/shifts/upcoming'),
      client.get('/me/documents'),
    ]);

    expect(onSessionExpired).toHaveBeenCalledTimes(1);
    // Every caller still learns its own request failed — the latch silences the
    // session announcement, not the error.
    expect(results.map((result) => result.status)).toEqual(['rejected', 'rejected', 'rejected']);
    for (const result of results) {
      expect((result as PromiseRejectedResult).reason).toMatchObject({
        kind: 'unauthorized',
        status: 401,
      });
    }
  });

  it('stays latched for later 401s in the same dead session', async () => {
    const onSessionExpired = jest.fn();
    const fetchImpl = jest.fn().mockResolvedValue(respondWith(401, {}));
    const client = clientWith(fetchImpl, { onSessionExpired });

    await expect(client.get('/a')).rejects.toBeInstanceOf(ApiError);
    await expect(client.get('/b')).rejects.toBeInstanceOf(ApiError);

    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it('re-arms once a new session starts, so the next expiry is announced again', async () => {
    const onSessionExpired = jest.fn();
    const fetchImpl = jest.fn().mockResolvedValue(respondWith(401, {}));
    const client = clientWith(fetchImpl, { onSessionExpired });

    await expect(client.get('/a')).rejects.toBeInstanceOf(ApiError);
    client.resetSession();
    await expect(client.get('/a')).rejects.toBeInstanceOf(ApiError);

    expect(onSessionExpired).toHaveBeenCalledTimes(2);
  });

  // PRD A8: `is_active` is enforced on the guard, so a deactivated employee's
  // next request is a 401 like any other — same one-shot path.
  it('treats a mid-session deactivation as the same single expiry', async () => {
    const onSessionExpired = jest.fn();
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(respondWith(401, { message: 'Tu cuenta fue desactivada.' }));

    await expect(
      clientWith(fetchImpl, { onSessionExpired }).post('/marks', { type: 'in' }),
    ).rejects.toMatchObject({ userMessage: 'Tu cuenta fue desactivada.' });
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it('does not treat any other failure as a session ending', async () => {
    const onSessionExpired = jest.fn();

    for (const status of [403, 404, 422, 500]) {
      const fetchImpl = jest.fn().mockResolvedValue(respondWith(status, {}));
      await expect(clientWith(fetchImpl, { onSessionExpired }).get('/a')).rejects.toBeInstanceOf(
        ApiError,
      );
    }

    expect(onSessionExpired).not.toHaveBeenCalled();
  });
});

describe('validation failures reach the form', () => {
  // #3 — end to end: the server's Spanish message arrives at the caller keyed
  // by field, ready to sit under the input that caused it.
  it('surfaces per-field server messages from a 422', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      respondWith(422, {
        message: 'Los datos entregados no son válidos.',
        errors: { email: ['Estas credenciales no coinciden con nuestros registros.'] },
      }),
    );

    await expect(clientWith(fetchImpl).post('/login', {})).rejects.toMatchObject({
      kind: 'validation',
      userMessage: 'Los datos entregados no son válidos.',
    });

    try {
      await clientWith(fetchImpl).post('/login', {});
    } catch (error) {
      expect(isApiError(error) && error.messageFor('email')).toBe(
        'Estas credenciales no coinciden con nuestros registros.',
      );
    }
  });
});

// #1 — the app-wide instance features import. It delegates rather than being a
// client itself, so a module that imported `api` at load time still gets the one
// `configureApi` installed later, with the real token store behind it.
describe('the app-wide client', () => {
  it('routes through whatever configureApi installed most recently', async () => {
    const first = jest.fn().mockResolvedValue(respondWith(200, { from: 'first' }));
    const second = jest.fn().mockResolvedValue(respondWith(200, { from: 'second' }));

    configureApi({ baseUrl: BASE_URL, fetch: first, getToken: () => 'tok_123' });
    await expect(api.get('/me/today')).resolves.toEqual({ from: 'first' });
    expect(headerOf(lastRequest(first).init, 'Authorization')).toBe('Bearer tok_123');

    configureApi({ baseUrl: BASE_URL, fetch: second });
    await expect(api.get('/me/today')).resolves.toEqual({ from: 'second' });
    expect(first).toHaveBeenCalledTimes(1);
  });

  it('exposes every verb, so nothing has a reason to reach for fetch', () => {
    for (const method of ['request', 'get', 'post', 'put', 'patch', 'del', 'resetSession']) {
      expect(typeof api[method as keyof typeof api]).toBe('function');
    }
  });
});

describe('failures that never reached the server', () => {
  // #5 — what the offline queue branches on.
  it('reports a rejected fetch as a network failure, in Spanish', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new TypeError('Network request failed'));

    await expect(clientWith(fetchImpl).get('/me/today')).rejects.toMatchObject({
      kind: 'network',
      userMessage: es.errors.network,
      isConnectivityFailure: true,
    });
  });

  it('aborts and reports a timeout when the server stops answering', async () => {
    jest.useFakeTimers();

    const fetchImpl = jest.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new Error('Aborted')));
        }),
    );

    const pending = clientWith(fetchImpl as unknown as jest.Mock).get('/me/today');
    const assertion = expect(pending).rejects.toMatchObject({
      kind: 'timeout',
      userMessage: es.errors.timeout,
      isConnectivityFailure: true,
    });

    await jest.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
    await assertion;

    jest.useRealTimers();
  });

  it('honours a per-request timeout override', async () => {
    jest.useFakeTimers();

    const fetchImpl = jest.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new Error('Aborted')));
        }),
    );

    const pending = clientWith(fetchImpl as unknown as jest.Mock).get('/me/today', {
      timeoutMs: 50,
    });
    const assertion = expect(pending).rejects.toMatchObject({ kind: 'timeout' });

    await jest.advanceTimersByTimeAsync(50);
    await assertion;

    jest.useRealTimers();
  });

  it('clears the timer on a request that answered, so nothing aborts later', async () => {
    jest.useFakeTimers();
    const clearSpy = jest.spyOn(globalThis, 'clearTimeout');
    const fetchImpl = jest.fn().mockResolvedValue(respondWith(200, {}));

    await clientWith(fetchImpl).get('/me/today');

    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
    jest.useRealTimers();
  });

  // A screen unmounting is the app's own doing; turning it into a Spanish error
  // would put a message on screen for something nobody did wrong.
  it('lets an abort during the request through as itself, not as a client error', async () => {
    const controller = new AbortController();
    const abortReason = new Error('Screen unmounted');
    const fetchImpl = jest.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(abortReason));
        }),
    );

    const pending = clientWith(fetchImpl as unknown as jest.Mock, {
      getToken: () => 'tok_123',
    }).get('/me/today', { signal: controller.signal });
    await Promise.resolve();
    controller.abort(abortReason);

    await expect(pending).rejects.toBe(abortReason);
  });

  // Reading the token is an async trip to SecureStore. A screen that unmounts
  // during it must still stop the request, and the request must provably never
  // have been sent — the punch queue decides what to retry on exactly that.
  it('cancels before the network when aborted while the token is being read', async () => {
    const controller = new AbortController();
    const abortReason = new Error('Screen unmounted');
    const fetchImpl = jest.fn().mockResolvedValue(respondWith(200, {}));

    const pending = clientWith(fetchImpl, {
      getToken: () => new Promise<string>((resolve) => setTimeout(() => resolve('tok_123'), 10)),
    }).get('/me/today', { signal: controller.signal });
    controller.abort(abortReason);

    await expect(pending).rejects.toBe(abortReason);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('a throttled response (KMO-50)', () => {
  /** A response that carries headers, which `respondWith` deliberately does not. */
  function throttledResponse(retryAfter?: string): Response {
    return {
      ok: false,
      status: 429,
      text: async () => JSON.stringify({ message: 'Too Many Attempts.' }),
      headers: {
        get: (name: string) => (name === 'Retry-After' ? (retryAfter ?? null) : null),
      },
    } as unknown as Response;
  }

  it('carries Retry-After from the response onto the error', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(throttledResponse('59'));
    const client = createApiClient({ baseUrl: BASE_URL, fetch: fetchImpl });

    // The whole point of this test: the client is the only thing holding the
    // Response, so a screen can only ever back off if it passes the headers on.
    await expect(client.get('/marks')).rejects.toMatchObject({
      kind: 'rateLimited',
      retryAfterSeconds: 59,
    });
  });

  it('survives a response with no headers, which the other doubles here are', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(respondWith(429, { message: 'Too Many Attempts.' }));
    const client = createApiClient({ baseUrl: BASE_URL, fetch: fetchImpl });

    await expect(client.get('/marks')).rejects.toMatchObject({
      kind: 'rateLimited',
      retryAfterSeconds: undefined,
    });
  });

  it('does not announce a session expiry for a throttle', async () => {
    const onSessionExpired = jest.fn();
    const fetchImpl = jest.fn().mockResolvedValue(throttledResponse('30'));
    const client = createApiClient({ baseUrl: BASE_URL, fetch: fetchImpl, onSessionExpired });

    await expect(client.get('/marks')).rejects.toThrow();

    // A 429 is the server pacing the app, not refusing its token. Ending the
    // session here would sign an employee out for typing too fast.
    expect(onSessionExpired).not.toHaveBeenCalled();
  });
});
