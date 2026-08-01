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
  | 'server'
  | 'client'
  | 'malformed';

/** Laravel's `errors` bag: one field, one or more messages, already in Spanish. */
export type FieldErrors = Readonly<Record<string, readonly string[]>>;

type ApiErrorInit = {
  kind: ApiErrorKind;
  status?: number;
  serverMessage?: string;
  fieldErrors?: FieldErrors;
  cause?: unknown;
};

export class ApiError extends Error {
  readonly kind: ApiErrorKind;

  /** The HTTP status, absent when the request never reached the server. */
  readonly status: number | undefined;

  /** The server's own `message`, kept separate from the fallback copy. */
  readonly serverMessage: string | undefined;

  /** Field-level messages from a 422. Empty for every other kind. */
  readonly fieldErrors: FieldErrors;

  constructor({ kind, status, serverMessage, fieldErrors, cause }: ApiErrorInit) {
    // The `Error` message is for logs and stack traces; `userMessage` is what an
    // employee reads. Keeping them apart is what stops an English fetch message
    // reaching a screen.
    super(`API request failed (${kind}${status === undefined ? '' : ` ${status}`})`);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
    this.serverMessage = serverMessage;
    this.fieldErrors = fieldErrors ?? {};
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
export function errorFromResponse(status: number, body: unknown): ApiError {
  return new ApiError({
    kind: kindForStatus(status),
    status,
    serverMessage: readMessage(body),
    fieldErrors: readFieldErrors(body),
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
    default:
      return status >= 500 ? 'server' : 'client';
  }
}

function readMessage(body: unknown): string | undefined {
  if (!isRecord(body)) {
    return undefined;
  }

  return typeof body.message === 'string' ? body.message : undefined;
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
