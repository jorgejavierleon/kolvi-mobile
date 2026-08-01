/**
 * The typed `/api/v1` client. Nothing else in the app calls `fetch`.
 *
 * Everything that has to happen on every request happens once, here: the base URL,
 * the Sanctum bearer token, the JSON headers, a timeout, and the single place a
 * 401 turns into "your session ended". A screen that talked to `fetch` directly
 * would be a screen that quietly skipped one of those.
 *
 * What the client deliberately does **not** own: where the token is kept (KMO-9
 * puts it in SecureStore) and what happens on the way out (KMO-11 clears the
 * session and routes to login). Both arrive as injected functions, so this module
 * stays testable without a device and those tickets can change their half without
 * touching transport.
 */

import { REQUEST_TIMEOUT_MS, resolveApiBaseUrl } from './config';
import { errorFromResponse, malformedResponseError, networkError, timeoutError } from './errors';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Reads the current token. Async because SecureStore is async, and nullable
 * because an unauthenticated request (the login call itself) is legitimate.
 */
export type TokenProvider = () => string | null | Promise<string | null>;

export type ApiClientOptions = {
  /** Defaults to `EXPO_PUBLIC_API_URL` + `/api/v1`. */
  baseUrl?: string;
  getToken?: TokenProvider;
  /**
   * Called at most once per session when the server stops accepting the token —
   * an expired token, or an employee deactivated mid-session (PRD A7/A8).
   */
  onSessionExpired?: () => void;
  timeoutMs?: number;
  /** Injected in tests. Production uses the runtime's `fetch`. */
  fetch?: typeof globalThis.fetch;
};

export type RequestOptions = {
  /** Appended as a query string; `undefined` values are dropped, not sent empty. */
  query?: Record<string, string | number | boolean | undefined>;
  /** Serialised as JSON. Datetimes must already be naive strings — see `./datetime`. */
  body?: unknown;
  /** Caller's own cancellation, e.g. a screen unmounting. Composed with the timeout. */
  signal?: AbortSignal;
  /** Overrides the client default, for an endpoint known to be slow. */
  timeoutMs?: number;
  headers?: Record<string, string>;
};

export type ApiClient = {
  request<T>(method: HttpMethod, path: string, options?: RequestOptions): Promise<T>;
  get<T>(path: string, options?: RequestOptions): Promise<T>;
  post<T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body'>): Promise<T>;
  put<T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body'>): Promise<T>;
  patch<T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body'>): Promise<T>;
  del<T>(path: string, options?: RequestOptions): Promise<T>;
  /**
   * Re-arms the session-expiry latch. Called when a new session starts, so the
   * next expiry is announced again rather than swallowed by the previous one.
   */
  resetSession(): void;
};

export function createApiClient(options: ApiClientOptions = {}): ApiClient {
  const {
    baseUrl = resolveApiBaseUrl(),
    getToken,
    onSessionExpired,
    timeoutMs = REQUEST_TIMEOUT_MS,
    fetch: fetchImpl = globalThis.fetch,
  } = options;

  /**
   * AC#4. Opening the app fires several requests at once, and if the token has
   * expired they all come back 401 together. Announcing each one would clear the
   * session repeatedly and stack login prompts, so the first 401 latches and the
   * rest are still thrown to their own callers but stay silent about the session.
   *
   * A plain boolean is enough: JavaScript is single-threaded, so no two responses
   * are ever inside this check at the same time.
   */
  let sessionExpiryAnnounced = false;

  function announceSessionExpiry(): void {
    if (sessionExpiryAnnounced) {
      return;
    }

    sessionExpiryAnnounced = true;
    onSessionExpired?.();
  }

  async function request<T>(
    method: HttpMethod,
    path: string,
    requestOptions: RequestOptions = {},
  ): Promise<T> {
    const url = buildUrl(baseUrl, path, requestOptions.query);
    const hasBody = requestOptions.body !== undefined;

    const controller = new AbortController();
    const effectiveTimeout = requestOptions.timeoutMs ?? timeoutMs;
    let timedOut = false;

    // The clock and the caller's signal are both armed before the token lookup,
    // not after it: reading the token is an async trip to SecureStore, and a
    // request that cannot be cancelled during it is a request that outlives the
    // screen that asked for it.
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, effectiveTimeout);

    // The caller's signal and ours both have to be able to stop the request, and
    // only `fetch` gets a signal, so the caller's is chained onto ours.
    const abortFromCaller = () => controller.abort();
    requestOptions.signal?.addEventListener('abort', abortFromCaller);

    let response: Response;
    try {
      const token = (await getToken?.()) ?? null;

      // Cancelled while the token was being read. `fetch` is never called, so
      // the request provably never reached the server.
      if (requestOptions.signal?.aborted === true) {
        throw abortReasonOf(requestOptions.signal);
      }

      if (timedOut) {
        throw timeoutError();
      }

      response = await fetchImpl(url, {
        method,
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
          ...(token === null ? {} : { Authorization: `Bearer ${token}` }),
          ...requestOptions.headers,
        },
        ...(hasBody ? { body: JSON.stringify(requestOptions.body) } : {}),
      });
    } catch (cause) {
      if (timedOut) {
        throw timeoutError();
      }

      // The caller cancelled deliberately: their abort reason is the truth, and
      // turning it into a Spanish error would put a message on screen for
      // something the app itself did.
      if (requestOptions.signal?.aborted === true) {
        throw cause;
      }

      // Everything `fetch` rejects with that is not an abort is a connectivity
      // failure: DNS, no route, radio off, TLS refused. None of them reached the
      // server, so none of them changed anything.
      throw networkError(cause);
    } finally {
      clearTimeout(timer);
      requestOptions.signal?.removeEventListener('abort', abortFromCaller);
    }

    return handleResponse<T>(response);
  }

  async function handleResponse<T>(response: Response): Promise<T> {
    const body = await readBody(response);

    if (!response.ok) {
      const error = errorFromResponse(response.status, body);

      if (error.kind === 'unauthorized') {
        announceSessionExpiry();
      }

      throw error;
    }

    // 204, and a 200 with an empty body, are legitimate answers to a DELETE or a
    // command endpoint. The caller types those as `void`.
    if (body === undefined) {
      return undefined as T;
    }

    return body as T;
  }

  return {
    request,
    get<T>(path: string, requestOptions?: RequestOptions): Promise<T> {
      return request<T>('GET', path, requestOptions);
    },
    post<T>(path: string, body?: unknown, requestOptions?: Omit<RequestOptions, 'body'>) {
      return request<T>('POST', path, { ...requestOptions, body });
    },
    put<T>(path: string, body?: unknown, requestOptions?: Omit<RequestOptions, 'body'>) {
      return request<T>('PUT', path, { ...requestOptions, body });
    },
    patch<T>(path: string, body?: unknown, requestOptions?: Omit<RequestOptions, 'body'>) {
      return request<T>('PATCH', path, { ...requestOptions, body });
    },
    del<T>(path: string, requestOptions?: RequestOptions): Promise<T> {
      return request<T>('DELETE', path, requestOptions);
    },
    resetSession: () => {
      sessionExpiryAnnounced = false;
    },
  };
}

/**
 * Read the body without letting the reading itself become the failure.
 *
 * A 500 from a load balancer is HTML, and a 204 is nothing at all. Neither is a
 * parse error worth reporting: for a failed response the status already carries
 * the meaning, and for an empty success there is nothing to report.
 */
async function readBody(response: Response): Promise<unknown> {
  let text: string;
  try {
    text = await response.text();
  } catch (cause) {
    // The body stream died mid-read — the connection dropped after the headers.
    throw response.ok
      ? malformedResponseError(cause)
      : errorFromResponse(response.status, undefined);
  }

  if (text.length === 0) {
    return undefined;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch (cause) {
    if (response.ok) {
      throw malformedResponseError(cause);
    }

    return undefined;
  }
}

/**
 * What a deliberate cancellation should reject with. `AbortSignal.reason` is the
 * caller's own value where the runtime supplies one; the fallback keeps the
 * rejection an `Error` rather than `undefined`, which nothing downstream can log.
 */
function abortReasonOf(signal: AbortSignal): unknown {
  return signal.reason ?? new Error('Request aborted by the caller');
}

function buildUrl(
  baseUrl: string,
  path: string,
  query: RequestOptions['query'] = undefined,
): string {
  const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;

  if (query === undefined) {
    return url;
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      params.append(key, String(value));
    }
  }

  const queryString = params.toString();

  return queryString.length === 0 ? url : `${url}?${queryString}`;
}

let configured: ApiClient | undefined;

/**
 * Install the app-wide client. Called once at startup, where the token store and
 * the session-expiry route are both reachable.
 */
export function configureApi(options: ApiClientOptions = {}): ApiClient {
  configured = createApiClient(options);

  return configured;
}

function current(): ApiClient {
  configured ??= createApiClient();

  return configured;
}

/**
 * The client screens and feature code import: `api.get<TodayResponse>('/me/today')`.
 *
 * It delegates rather than being a client itself, so `configureApi` can install the
 * real one after startup without every module having imported a stale instance.
 */
export const api: ApiClient = {
  request<T>(method: HttpMethod, path: string, options?: RequestOptions): Promise<T> {
    return current().request<T>(method, path, options);
  },
  get<T>(path: string, options?: RequestOptions): Promise<T> {
    return current().get<T>(path, options);
  },
  post<T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body'>): Promise<T> {
    return current().post<T>(path, body, options);
  },
  put<T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body'>): Promise<T> {
    return current().put<T>(path, body, options);
  },
  patch<T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body'>): Promise<T> {
    return current().patch<T>(path, body, options);
  },
  del<T>(path: string, options?: RequestOptions): Promise<T> {
    return current().del<T>(path, options);
  },
  resetSession(): void {
    current().resetSession();
  },
};
