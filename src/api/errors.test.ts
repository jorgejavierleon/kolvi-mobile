import { es } from '@/i18n';

import {
  ApiError,
  errorFromResponse,
  isApiError,
  malformedResponseError,
  networkError,
  timeoutError,
  type ApiErrorKind,
} from './errors';

const KINDS: ApiErrorKind[] = [
  'network',
  'timeout',
  'unauthorized',
  'forbidden',
  'notFound',
  'validation',
  'server',
  'client',
  'malformed',
];

describe('errorFromResponse', () => {
  // #5 — the mapping a caller branches on. The status code stops at this table;
  // no feature has to remember that 422 is the validation one.
  it.each<[number, ApiErrorKind]>([
    [400, 'client'],
    [401, 'unauthorized'],
    [403, 'forbidden'],
    [404, 'notFound'],
    [409, 'client'],
    [419, 'unauthorized'],
    [422, 'validation'],
    [429, 'client'],
    [500, 'server'],
    [503, 'server'],
  ])('maps %i to %s', (status, kind) => {
    expect(errorFromResponse(status, {}).kind).toBe(kind);
  });

  it('keeps the status for logging without putting it in front of an employee', () => {
    const error = errorFromResponse(503, undefined);

    expect(error.status).toBe(503);
    expect(error.userMessage).not.toMatch(/503/);
  });
});

describe('validation errors', () => {
  // #3 — Laravel's 422 shape, and the messages are already Spanish because
  // `ams` renders them through `lang/`.
  const response = {
    message: 'Los datos entregados no son válidos.',
    errors: {
      email: ['El campo email es obligatorio.', 'El email debe ser válido.'],
      password: ['La contraseña debe tener al menos 8 caracteres.'],
    },
  };

  it('maps the bag to per-field messages the UI can put under an input', () => {
    const error = errorFromResponse(422, response);

    expect(error.messageFor('email')).toBe('El campo email es obligatorio.');
    expect(error.messageFor('password')).toBe('La contraseña debe tener al menos 8 caracteres.');
    expect(error.fieldErrors.email).toHaveLength(2);
  });

  it('lists the rejected fields, so a form can focus the first bad input', () => {
    expect(errorFromResponse(422, response).invalidFields).toEqual(['email', 'password']);
  });

  it('returns nothing for a field the server did not reject', () => {
    expect(errorFromResponse(422, response).messageFor('device_name')).toBeUndefined();
  });

  it('accepts a bare string for a field, which some handlers emit', () => {
    const error = errorFromResponse(422, { errors: { email: 'El email ya está en uso.' } });

    expect(error.messageFor('email')).toBe('El email ya está en uso.');
  });

  // A half-understood bag would put the wrong message under the wrong input,
  // which is worse than showing the summary message alone.
  it.each([
    ['no body', undefined],
    ['a string body', 'Not JSON'],
    ['an array body', [1, 2, 3]],
    ['errors as a string', { errors: 'nope' }],
    ['errors as an array', { errors: ['nope'] }],
    ['non-string messages', { errors: { email: [{ text: 'nope' }] } }],
  ])('drops %s rather than guessing at it', (_label, body) => {
    const error = errorFromResponse(422, body);

    expect(error.fieldErrors).toEqual({});
    expect(error.invalidFields).toEqual([]);
  });
});

describe('the message an employee reads', () => {
  // #3 — the server knows the password was wrong rather than merely that the
  // request was refused, so its sentence wins over anything the app could say.
  it('prefers the server message over the app catalogue', () => {
    const error = errorFromResponse(401, { message: 'Tu cuenta está desactivada.' });

    expect(error.userMessage).toBe('Tu cuenta está desactivada.');
    expect(error.userMessage).not.toBe(es.errors.unauthorized);
  });

  it('falls back to the catalogue when the body carries no message', () => {
    expect(errorFromResponse(500, undefined).userMessage).toBe(es.errors.server);
    expect(errorFromResponse(500, '<html>502 Bad Gateway</html>').userMessage).toBe(
      es.errors.server,
    );
  });

  it('treats a blank server message as no message at all', () => {
    expect(errorFromResponse(500, { message: '   ' }).userMessage).toBe(es.errors.server);
  });

  // #6 — every path out of here is Spanish from the catalogue or from the
  // server. `Error.message` is the log line and must never reach a screen.
  it.each(KINDS)('has Spanish catalogue copy for %s, distinct from the log message', (kind) => {
    const error = new ApiError({ kind });

    expect(error.userMessage).toBe(es.errors[kind]);
    expect(error.userMessage.length).toBeGreaterThan(0);
    expect(error.userMessage).not.toBe(error.message);
    expect(error.userMessage).not.toMatch(/[A-Za-z]+Error|failed|request/i);
  });
});

describe('telling a dead connection from a refusal', () => {
  // #5 — the offline queue retries one of these and shows the other to the
  // employee. Getting it backwards either drops a punch or queues one the
  // server will never accept.
  it('reports a failure that never reached the server as retryable', () => {
    for (const error of [networkError(new TypeError('Network request failed')), timeoutError()]) {
      expect(error.isConnectivityFailure).toBe(true);
      expect(error.isServerFailure).toBe(false);
      expect(error.status).toBeUndefined();
    }
  });

  it('separates a timeout from an absent network, so a slow link reads as slow', () => {
    expect(networkError(new Error('boom')).kind).toBe('network');
    expect(timeoutError().kind).toBe('timeout');
    expect(networkError(new Error('boom')).userMessage).not.toBe(timeoutError().userMessage);
  });

  it('reports an answered request as a server failure', () => {
    for (const status of [401, 403, 404, 422, 500]) {
      expect(errorFromResponse(status, {}).isServerFailure).toBe(true);
      expect(errorFromResponse(status, {}).isConnectivityFailure).toBe(false);
    }
  });

  it('counts an unreadable success as neither — the request landed, the answer did not', () => {
    const error = malformedResponseError(new SyntaxError('Unexpected token <'));

    expect(error.isConnectivityFailure).toBe(false);
    expect(error.isServerFailure).toBe(false);
  });

  it('keeps the underlying failure as the cause, for crash reporting', () => {
    const cause = new TypeError('Network request failed');

    expect(networkError(cause).cause).toBe(cause);
  });
});

describe('isApiError', () => {
  it('narrows an unknown catch to the client errors and nothing else', () => {
    expect(isApiError(errorFromResponse(404, {}))).toBe(true);
    expect(isApiError(new Error('boom'))).toBe(false);
    expect(isApiError('boom')).toBe(false);
    expect(isApiError(undefined)).toBe(false);
  });

  it('is still an Error, so it can be thrown and logged like one', () => {
    const error = errorFromResponse(500, {});

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ApiError');
    expect(error.message).toContain('server');
  });
});
