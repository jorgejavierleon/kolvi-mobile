/**
 * One error type for every way a request can fail, so a caller branches on a
 * `kind` it can enumerate rather than on a status code it has to remember.
 *
 * Two things the app depends on live here. First, the offline queue (KMO-22/23)
 * has to tell "the phone has no signal" from "the server said no" — the former is
 * retried later, the latter is a decision that must be shown to the employee, and
 * confusing them either drops a punch or queues one that will never be accepted.
 * Second, Res. 38 Art. 5 requires Spanish, so no error is ever allowed to surface
 * a status line, an exception name or an English fetch message.
 *
 * Third, since KMO-23: a 422 can carry a machine-readable `code` alongside its
 * Spanish `message`. The offline queue has two refusals that both answer 422 and
 * need opposite outcomes — `queued_punch_too_old` is filed and must never be
 * retried, `queued_punch_in_future` is dropped and must never be retried either,
 * but a plain validation 422 is a client bug and is neither. Branching on the
 * Spanish sentence would make that decision depend on wording somebody may
 * improve, so `code` travels through this boundary rather than being read off the
 * body ad hoc at each call site.
 */

import { es } from '@/i18n';

/**
 * The failure kinds, in the order a caller usually cares about them.
 *
 * `network` and `timeout` mean the request never got an answer, so nothing
 * happened server-side and retrying is safe. Everything else means the server
 * answered.
 */
export type ApiErrorKind =
  | 'network'
  | 'timeout'
  | 'unauthorized'
  | 'forbidden'
  | 'notFound'
  | 'validation'
  | 'rateLimited'
  | 'server'
  | 'client'
  | 'malformed';

/** Laravel's `errors` bag: one field, one or more messages, already in Spanish. */
export type FieldErrors = Readonly<Record<string, readonly string[]>>;

/**
 * Just enough of `Headers` to read one off a response.
 *
 * Structural rather than the DOM `Headers` type, because the response doubles in
 * the tests are `{ok, status, text}` object literals. A real `Response` always
 * carries headers, so the only thing this shape buys is not having to rewrite
 * every helper in three test files to add a property they do not exercise.
 */
export type ResponseHeaders = {
  get(name: string): string | null;
};

type ApiErrorInit = {
  kind: ApiErrorKind;
  status?: number;
  serverMessage?: string;
  code?: string;
  fieldErrors?: FieldErrors;
  retryAfterSeconds?: number;
  cause?: unknown;
};

export class ApiError extends Error {
  readonly kind: ApiErrorKind;

  /** The HTTP status, absent when the request never reached the server. */
  readonly status: number | undefined;

  /** The server's own `message`, kept separate from the fallback copy. */
  readonly serverMessage: string | undefined;

  /**
   * The server's machine-readable refusal code, when it sent one — `ams` puts
   * this on the two offline-queue 422s (`queued_punch_too_old`,
   * `queued_punch_in_future`) and on nothing else today. `undefined` for a
   * status with no code, and for a 422 that is plain Laravel validation rather
   * than one of those two.
   */
  readonly code: string | undefined;

  /** Field-level messages from a 422. Empty for every other kind. */
  readonly fieldErrors: FieldErrors;

  /**
   * How long the server said to wait, from `Retry-After` on a 429. Undefined
   * when the header was absent or unreadable — the caller then knows only that
   * it was refused for going too fast, which is still worth saying.
   */
  readonly retryAfterSeconds: number | undefined;

  constructor({
    kind,
    status,
    serverMessage,
    code,
    fieldErrors,
    retryAfterSeconds,
    cause,
  }: ApiErrorInit) {
    // The `Error` message is for logs and stack traces; `userMessage` is what an
    // employee reads. Keeping them apart is what stops an English fetch message
    // reaching a screen.
    super(`API request failed (${kind}${status === undefined ? '' : ` ${status}`})`);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
    this.serverMessage = serverMessage;
    this.code = code;
    this.fieldErrors = fieldErrors ?? {};
    this.retryAfterSeconds = retryAfterSeconds;
    this.cause = cause;
    // Hermes and the Babel class transform both need this for `instanceof` to
    // survive extending a built-in.
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  /**
   * The sentence to put in front of the employee.
   *
   * The server's message wins whenever there is one: it knows that the password
   * was wrong rather than merely that the request was rejected, and `ams` already
   * emits it in Spanish through `lang/`. The catalogue is the fallback for a
   * failure the server never saw, or a response with no usable message in it.
   */
  get userMessage(): string {
    // The one kind where the server does not get to speak.
    //
    // A 429 from `ams` is always an `Illuminate` ThrottleRequestsException, whose
    // body is the framework's untranslated `Too Many Attempts.` — and this getter
    // would otherwise prefer it, putting English in front of a Chilean employee
    // (Art. 5). There is no good Spanish being discarded here: a Fortify-shaped
    // throttle arrives as a 422 carrying `errors.email` instead, so no 429 in this
    // API has a translated sentence in it. `serverMessage` stays on the error for
    // logging either way.
    if (this.kind === 'rateLimited') {
      return es.errors.rateLimited;
    }

    const serverMessage = this.serverMessage?.trim();

    return serverMessage !== undefined && serverMessage.length > 0
      ? serverMessage
      : es.errors[this.kind];
  }

  /** True when the request never reached the server, so retrying it is safe. */
  get isConnectivityFailure(): boolean {
    return this.kind === 'network' || this.kind === 'timeout';
  }

  /** True when the server answered and the answer was a failure. */
  get isServerFailure(): boolean {
    return !this.isConnectivityFailure && this.kind !== 'malformed';
  }

  /** The first message for a field, for the error line under an input. */
  messageFor(field: string): string | undefined {
    return this.fieldErrors[field]?.[0];
  }

  /** Every field the server rejected, for focusing the first bad input. */
  get invalidFields(): string[] {
    return Object.keys(this.fieldErrors);
  }
}

/** Narrowing helper, so a `catch (error: unknown)` stays honest. */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/**
 * Build the error for a response the server actually returned.
 *
 * `body` is whatever came back parsed, or `undefined` when there was no readable
 * body — a 500 from a proxy is often HTML, and it must still produce a Spanish
 * sentence rather than a parse failure.
 */
export function errorFromResponse(
  status: number,
  body: unknown,
  headers?: ResponseHeaders,
): ApiError {
  return new ApiError({
    kind: kindForStatus(status),
    status,
    serverMessage: readMessage(body),
    code: readCode(body),
    fieldErrors: readFieldErrors(body),
    retryAfterSeconds: readRetryAfter(headers),
  });
}

/** The request never got an answer: no DNS, no route, radio off, server unreachable. */
export function networkError(cause: unknown): ApiError {
  return new ApiError({ kind: 'network', cause });
}

/** The request got no answer within the timeout. Distinct from `network` so a slow
 * link can be reported as slow rather than as absent. */
export function timeoutError(): ApiError {
  return new ApiError({ kind: 'timeout' });
}

/** A 2xx whose body was not the JSON the caller was promised. */
export function malformedResponseError(cause?: unknown): ApiError {
  return new ApiError({ kind: 'malformed', cause });
}

function kindForStatus(status: number): ApiErrorKind {
  switch (status) {
    case 401:
      return 'unauthorized';
    case 403:
      return 'forbidden';
    case 404:
      return 'notFound';
    // 422 is Laravel's validation status; 419 is a CSRF/session mismatch, which on
    // a token-authenticated request means the token is no longer usable.
    case 422:
      return 'validation';
    case 419:
      return 'unauthorized';
    // The server is refusing because the app asked too often, not because the
    // request was wrong. Its own kind so a screen can wait rather than retry.
    case 429:
      return 'rateLimited';
    default:
      return status >= 500 ? 'server' : 'client';
  }
}

/**
 * `Retry-After`, as the delta-seconds Laravel sends.
 *
 * The header may also be an HTTP-date by the spec, and that form is deliberately
 * not parsed: `ams` never sends it, and a date parsed against a phone clock that
 * may be wrong would produce a wait the employee sits through for no reason.
 * Anything that is not a non-negative integer is treated as absent, which the
 * caller already has to handle.
 */
function readRetryAfter(headers: ResponseHeaders | undefined): number | undefined {
  const raw = headers?.get('Retry-After')?.trim();

  if (raw === undefined || raw === null || !/^\d+$/.test(raw)) {
    return undefined;
  }

  const seconds = Number(raw);

  return Number.isSafeInteger(seconds) ? seconds : undefined;
}

function readMessage(body: unknown): string | undefined {
  if (!isRecord(body)) {
    return undefined;
  }

  return typeof body.message === 'string' ? body.message : undefined;
}

function readCode(body: unknown): string | undefined {
  if (!isRecord(body)) {
    return undefined;
  }

  return typeof body.code === 'string' ? body.code : undefined;
}

/**
 * Laravel validates into `{message, errors: {field: [msg, …]}}`. Anything that is
 * not that shape is dropped rather than guessed at — a half-understood bag would
 * put the wrong message under the wrong input.
 */
function readFieldErrors(body: unknown): FieldErrors {
  if (!isRecord(body) || !isRecord(body.errors)) {
    return {};
  }

  const fieldErrors: Record<string, readonly string[]> = {};

  for (const [field, messages] of Object.entries(body.errors)) {
    if (typeof messages === 'string') {
      fieldErrors[field] = [messages];
      continue;
    }

    if (Array.isArray(messages)) {
      const strings = messages.filter((message): message is string => typeof message === 'string');
      if (strings.length > 0) {
        fieldErrors[field] = strings;
      }
    }
  }

  return fieldErrors;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
