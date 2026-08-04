import { act, render, screen, userEvent } from '@testing-library/react-native';

import { ApiError } from '@/api';
import { es, passwordResetSent, tooManyAttempts } from '@/i18n';

import { ForgotPassword } from './forgot-password';
import type { ForgotPasswordApi } from './forgot-password-api';

const EMAIL = 'empleado@example.com';

function fakeApi(overrides: Partial<ForgotPasswordApi> = {}): ForgotPasswordApi {
  return { requestReset: jest.fn(async () => undefined), ...overrides };
}

function refusingApi(error: ApiError): ForgotPasswordApi {
  return fakeApi({
    requestReset: jest.fn(async () => {
      throw error;
    }),
  });
}

async function fillAndSubmit(email = EMAIL) {
  const user = userEvent.setup();

  if (email !== '') {
    await user.type(screen.getByTestId('forgot-password-email'), email);
  }

  await user.press(screen.getByTestId('forgot-password-submit'));
}

describe('the form', () => {
  it('collects the address and explains what will happen (#1)', async () => {
    await render(<ForgotPassword onDone={jest.fn()} api={fakeApi()} />);

    expect(screen.getByLabelText(es.auth.email)).toBeOnTheScreen();
    expect(screen.getByText(es.auth.forgotPassword.intro)).toBeOnTheScreen();
    expect(screen.getByTestId('forgot-password-submit')).toBeOnTheScreen();
  });

  it('names an empty address without a round trip', async () => {
    const api = fakeApi();
    await render(<ForgotPassword onDone={jest.fn()} api={api} />);

    await userEvent.setup().press(screen.getByTestId('forgot-password-submit'));

    expect(screen.getByText(es.auth.emailRequired)).toBeOnTheScreen();
    expect(api.requestReset).not.toHaveBeenCalled();
  });

  it('trims the address before sending it', async () => {
    const api = fakeApi();
    await render(<ForgotPassword onDone={jest.fn()} api={api} />);

    await fillAndSubmit('  empleado@example.com  ');

    // A keyboard that appends a space is not a reason to send an address the
    // server will reject, or to key the limiter differently from the next try.
    expect(api.requestReset).toHaveBeenCalledWith(EMAIL);
  });

  it('does not submit twice on a double tap', async () => {
    let release = (): void => undefined;
    const api = fakeApi({
      requestReset: jest.fn(
        async () =>
          new Promise<void>((resolve) => {
            release = resolve;
          }),
      ),
    });
    await render(<ForgotPassword onDone={jest.fn()} api={api} />);

    const user = userEvent.setup();
    await user.type(screen.getByTestId('forgot-password-email'), EMAIL);
    await user.press(screen.getByTestId('forgot-password-submit'));
    await user.press(screen.getByTestId('forgot-password-submit'));

    expect(api.requestReset).toHaveBeenCalledTimes(1);

    await act(async () => {
      release();
    });
  });
});

describe('the confirmation (#2, #3)', () => {
  it('says where to look, on this phone, and for how long', async () => {
    await render(<ForgotPassword onDone={jest.fn()} api={fakeApi()} />);

    await fillAndSubmit();

    expect(screen.getByText(es.auth.forgotPassword.successTitle)).toBeOnTheScreen();
    expect(screen.getByText(passwordResetSent(EMAIL))).toBeOnTheScreen();
    expect(screen.getByText(es.auth.forgotPassword.retryHint)).toBeOnTheScreen();
  });

  // The criterion the endpoint's 204 exists for. `ams` answers identically for an
  // address with an account and one without, so a confirmation reading "te
  // enviamos un correo" would be a claim the app cannot support — and would make
  // this screen a way to test whether a given person works here.
  it('is conditional, so it discloses nothing about the address', async () => {
    await render(<ForgotPassword onDone={jest.fn()} api={fakeApi()} />);

    await fillAndSubmit('nadie-trabaja-aqui@example.com');

    const body = passwordResetSent('nadie-trabaja-aqui@example.com');

    expect(screen.getByText(body)).toBeOnTheScreen();
    expect(body).toContain('Si nadie-trabaja-aqui@example.com tiene una cuenta');
  });

  it('is identical for an address that has an account and one that does not', async () => {
    // Both are a 204 from the same fake, which is the point: nothing downstream
    // of the request can tell the two apart, so nothing on screen can either.
    await render(<ForgotPassword onDone={jest.fn()} api={fakeApi()} />);
    await fillAndSubmit(EMAIL);
    const known = screen.getByTestId('forgot-password-success');
    const knownText = screen.getByText(passwordResetSent(EMAIL));

    expect(known).toBeOnTheScreen();
    expect(knownText).toBeOnTheScreen();

    await render(<ForgotPassword onDone={jest.fn()} api={fakeApi()} />);
    await fillAndSubmit('nadie-trabaja-aqui@example.com');

    expect(screen.getByTestId('forgot-password-success')).toBeOnTheScreen();
    // Same sentence, same shape, only the address the employee typed differs.
    expect(screen.getByText(passwordResetSent('nadie-trabaja-aqui@example.com'))).toBeOnTheScreen();
  });

  it('replaces the form, so the only thing left to do is go back', async () => {
    await render(<ForgotPassword onDone={jest.fn()} api={fakeApi()} />);

    await fillAndSubmit();

    // A second submit can only earn a 429 — the limiter is what caps repetition
    // on this endpoint — so the button that would earn it is gone.
    expect(screen.queryByTestId('forgot-password-submit')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('forgot-password-email')).not.toBeOnTheScreen();
  });

  it('leaves the screen when the employee is done', async () => {
    const onDone = jest.fn();
    await render(<ForgotPassword onDone={onDone} api={fakeApi()} />);

    await fillAndSubmit();
    await userEvent.setup().press(screen.getByTestId('forgot-password-done'));

    expect(onDone).toHaveBeenCalled();
  });
});

describe('when it does not go through', () => {
  it('offers a retry for a lost connection and does not claim a mail was sent', async () => {
    const api = refusingApi(new ApiError({ kind: 'network' }));
    await render(<ForgotPassword onDone={jest.fn()} api={api} />);

    await fillAndSubmit();

    expect(screen.getByText(es.errors.network)).toBeOnTheScreen();
    expect(screen.getByTestId('forgot-password-retry')).toBeOnTheScreen();
    expect(screen.queryByTestId('forgot-password-success')).not.toBeOnTheScreen();
  });

  it('shows the server sentence for a refused address', async () => {
    const message = 'El campo correo electrónico no es válido.';
    const api = refusingApi(
      new ApiError({
        kind: 'validation',
        status: 422,
        serverMessage: message,
        fieldErrors: { email: [message] },
      }),
    );
    await render(<ForgotPassword onDone={jest.fn()} api={api} />);

    await fillAndSubmit('no-es-un-correo');

    expect(screen.getByText(message)).toBeOnTheScreen();
  });

  it('keeps the form on screen so the address can be corrected', async () => {
    const api = refusingApi(new ApiError({ kind: 'network' }));
    await render(<ForgotPassword onDone={jest.fn()} api={api} />);

    await fillAndSubmit();

    expect(screen.getByTestId('forgot-password-email')).toBeOnTheScreen();
  });
});

describe('a throttled request (#5)', () => {
  function throttledApi(retryAfterSeconds?: number): ForgotPasswordApi {
    return refusingApi(
      new ApiError({
        kind: 'rateLimited',
        status: 429,
        serverMessage: 'Too Many Attempts.',
        retryAfterSeconds,
      }),
    );
  }

  it('names the wait and holds the submit', async () => {
    await render(<ForgotPassword onDone={jest.fn()} api={throttledApi(45)} />);

    await fillAndSubmit();

    expect(screen.getByText(tooManyAttempts(45))).toBeOnTheScreen();
    expect(screen.getByTestId('forgot-password-submit')).toBeDisabled();
  });

  it('never puts the server English on screen', async () => {
    await render(<ForgotPassword onDone={jest.fn()} api={throttledApi(45)} />);

    await fillAndSubmit();

    expect(screen.queryByText('Too Many Attempts.')).not.toBeOnTheScreen();
  });

  it('offers no retry, because pressing again only feeds the limiter', async () => {
    await render(<ForgotPassword onDone={jest.fn()} api={throttledApi(45)} />);

    await fillAndSubmit();

    expect(screen.queryByTestId('forgot-password-retry')).not.toBeOnTheScreen();
  });

  it('does not resubmit while the wait is running', async () => {
    const api = throttledApi(45);
    await render(<ForgotPassword onDone={jest.fn()} api={api} />);

    await fillAndSubmit();
    expect(api.requestReset).toHaveBeenCalledTimes(1);

    await userEvent.setup().press(screen.getByTestId('forgot-password-submit'));

    expect(api.requestReset).toHaveBeenCalledTimes(1);
  });

  it('does not report the mail as on its way', async () => {
    await render(<ForgotPassword onDone={jest.fn()} api={throttledApi(45)} />);

    await fillAndSubmit();

    // A 429 means the request was not taken. The confirmation would send the
    // employee to wait for a mail nobody queued.
    expect(screen.queryByTestId('forgot-password-success')).not.toBeOnTheScreen();
  });

  it('says only that it was refused when the server named no interval', async () => {
    await render(<ForgotPassword onDone={jest.fn()} api={throttledApi()} />);

    await fillAndSubmit();

    expect(screen.getByText(es.errors.rateLimited)).toBeOnTheScreen();
  });
});
