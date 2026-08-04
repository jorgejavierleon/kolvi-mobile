import { act, render, screen, userEvent } from '@testing-library/react-native';

import { ApiError } from '@/api';
import { es, tooManyAttempts } from '@/i18n';

import { ChangePassword } from './change-password';
import type { PasswordApi } from './password-api';

/** The sentences `ams` actually returns, from `lang/es/validation.php`. */
const WRONG_CURRENT = 'La contraseña es incorrecta.';
const POLICY_FAILURE = 'El campo contraseña debe contener al menos un símbolo.';

function fakeApi(overrides: Partial<PasswordApi> = {}): PasswordApi {
  return { changePassword: jest.fn(async () => undefined), ...overrides };
}

function refusal(fieldErrors: Record<string, string[]>): ApiError {
  return new ApiError({ kind: 'validation', status: 422, fieldErrors });
}

type FillOptions = { current?: string; next?: string; confirm?: string };

async function fillAndSubmit({
  current = 'la-vieja',
  next = 'Marcaje-2026!',
  confirm = 'Marcaje-2026!',
}: FillOptions = {}) {
  const user = userEvent.setup();

  if (current !== '') {
    await user.type(screen.getByTestId('change-password-current'), current);
  }
  if (next !== '') {
    await user.type(screen.getByTestId('change-password-new'), next);
  }
  if (confirm !== '') {
    await user.type(screen.getByTestId('change-password-confirm'), confirm);
  }

  await user.press(screen.getByTestId('change-password-submit'));
}

describe('the form', () => {
  it('collects the current password and the new one twice (#1)', async () => {
    await render(<ChangePassword onDone={jest.fn()} api={fakeApi()} />);

    expect(screen.getByLabelText(es.auth.changePassword.current)).toBeOnTheScreen();
    expect(screen.getByLabelText(es.auth.changePassword.new)).toBeOnTheScreen();
    expect(screen.getByLabelText(es.auth.changePassword.confirm)).toBeOnTheScreen();
  });

  it('masks all three fields and offers a reveal on each', async () => {
    await render(<ChangePassword onDone={jest.fn()} api={fakeApi()} />);

    for (const field of ['current', 'new', 'confirm']) {
      expect(screen.getByTestId(`change-password-${field}`).props.secureTextEntry).toBe(true);
      expect(screen.getByTestId(`change-password-${field}-reveal`)).toBeOnTheScreen();
    }
  });

  it('says the password is the same one the web console takes', async () => {
    await render(<ChangePassword onDone={jest.fn()} api={fakeApi()} />);

    // There is one `users.password`. A screen that let an employee think this
    // was phone-only would be describing an account that does not exist.
    expect(screen.getByText(es.auth.changePassword.intro)).toBeOnTheScreen();
  });
});

describe('what it refuses to send', () => {
  it('names every empty field without a round trip', async () => {
    const api = fakeApi();
    await render(<ChangePassword onDone={jest.fn()} api={api} />);

    await userEvent.setup().press(screen.getByTestId('change-password-submit'));

    expect(screen.getByText(es.auth.changePassword.currentRequired)).toBeOnTheScreen();
    expect(screen.getByText(es.auth.changePassword.newRequired)).toBeOnTheScreen();
    expect(screen.getByText(es.auth.changePassword.confirmRequired)).toBeOnTheScreen();
    expect(api.changePassword).not.toHaveBeenCalled();
  });

  it('catches a mismatched confirmation locally', async () => {
    const api = fakeApi();
    await render(<ChangePassword onDone={jest.fn()} api={api} />);

    await fillAndSubmit({ next: 'Marcaje-2026!', confirm: 'Marcaje-2027!' });

    expect(screen.getByText(es.auth.changePassword.mismatch)).toBeOnTheScreen();
    expect(api.changePassword).not.toHaveBeenCalled();
  });

  it('does not call an empty confirmation a mismatch as well', async () => {
    await render(<ChangePassword onDone={jest.fn()} api={fakeApi()} />);

    await fillAndSubmit({ confirm: '' });

    expect(screen.getByText(es.auth.changePassword.confirmRequired)).toBeOnTheScreen();
    expect(screen.queryByText(es.auth.changePassword.mismatch)).not.toBeOnTheScreen();
  });
});

describe('what the server says', () => {
  it('sends the two passwords when the form is complete', async () => {
    const api = fakeApi();
    await render(<ChangePassword onDone={jest.fn()} api={api} />);

    await fillAndSubmit();

    expect(api.changePassword).toHaveBeenCalledWith({
      currentPassword: 'la-vieja',
      newPassword: 'Marcaje-2026!',
    });
  });

  it('shows a wrong current password under that field, in the server wording (#2)', async () => {
    const api = fakeApi({
      changePassword: jest.fn(async () => {
        throw refusal({ current_password: [WRONG_CURRENT] });
      }),
    });
    await render(<ChangePassword onDone={jest.fn()} api={api} />);

    await fillAndSubmit();

    expect(screen.getByText(WRONG_CURRENT)).toBeOnTheScreen();

    // Under the input it belongs to, and not under the other two. `aria-invalid`
    // is what a screen reader announces, so this is the assertion that the
    // message reached the right field rather than merely reaching the screen.
    expect(screen.getByTestId('change-password-current').props['aria-invalid']).toBe(true);
    expect(screen.getByTestId('change-password-new').props['aria-invalid']).toBe(false);
    expect(screen.queryByTestId('change-password-error')).not.toBeOnTheScreen();
  });

  it('shows a policy failure under the new-password field (#2)', async () => {
    const api = fakeApi({
      changePassword: jest.fn(async () => {
        throw refusal({ password: [POLICY_FAILURE] });
      }),
    });
    await render(<ChangePassword onDone={jest.fn()} api={api} />);

    await fillAndSubmit();

    expect(screen.getByText(POLICY_FAILURE)).toBeOnTheScreen();
    expect(screen.getByTestId('change-password-new').props['aria-invalid']).toBe(true);
    expect(screen.getByTestId('change-password-current').props['aria-invalid']).toBe(false);
    expect(screen.queryByTestId('change-password-error')).not.toBeOnTheScreen();
  });

  it('shows a refusal that names no field as a whole-form message', async () => {
    const api = fakeApi({
      changePassword: jest.fn(async () => {
        throw new ApiError({ kind: 'network' });
      }),
    });
    await render(<ChangePassword onDone={jest.fn()} api={api} />);

    await fillAndSubmit();

    expect(screen.getByTestId('change-password-error')).toBeOnTheScreen();
    expect(screen.getByText(es.errors.network)).toBeOnTheScreen();
  });

  it('keeps the form on screen after a refusal, so the employee can correct it', async () => {
    const api = fakeApi({
      changePassword: jest.fn(async () => {
        throw refusal({ current_password: [WRONG_CURRENT] });
      }),
    });
    await render(<ChangePassword onDone={jest.fn()} api={api} />);

    await fillAndSubmit();

    expect(screen.getByTestId('change-password-submit')).toBeOnTheScreen();
    expect(screen.queryByTestId('change-password-success')).not.toBeOnTheScreen();
  });
});

describe('when it works', () => {
  it('confirms the change and says the email was sent (#3)', async () => {
    await render(<ChangePassword onDone={jest.fn()} api={fakeApi()} />);

    await fillAndSubmit();

    expect(screen.getByText(es.auth.changePassword.successTitle)).toBeOnTheScreen();
    // Art. 7f is the email as much as the change, so the screen has to say it
    // is coming — an employee who did not make this change needs to recognise
    // the message as the warning it is.
    expect(screen.getByText(es.auth.changePassword.successBody)).toBeOnTheScreen();
  });

  it('replaces the form rather than leaving it fillable', async () => {
    await render(<ChangePassword onDone={jest.fn()} api={fakeApi()} />);

    await fillAndSubmit();

    // A second submit would now carry the old current password and fail. The
    // form is gone rather than armed with a value that has stopped being true.
    expect(screen.queryByTestId('change-password-submit')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('change-password-current')).not.toBeOnTheScreen();
  });

  it('leaves the screen when the employee is done', async () => {
    const onDone = jest.fn();
    await render(<ChangePassword onDone={onDone} api={fakeApi()} />);

    await fillAndSubmit();
    await userEvent.setup().press(screen.getByTestId('change-password-done'));

    expect(onDone).toHaveBeenCalled();
  });

  it('does not submit twice on a double tap', async () => {
    let release = (): void => undefined;
    const api = fakeApi({
      changePassword: jest.fn(
        async () =>
          new Promise<void>((resolve) => {
            release = resolve;
          }),
      ),
    });
    await render(<ChangePassword onDone={jest.fn()} api={api} />);

    const user = userEvent.setup();
    await user.type(screen.getByTestId('change-password-current'), 'la-vieja');
    await user.type(screen.getByTestId('change-password-new'), 'Marcaje-2026!');
    await user.type(screen.getByTestId('change-password-confirm'), 'Marcaje-2026!');

    await user.press(screen.getByTestId('change-password-submit'));
    await user.press(screen.getByTestId('change-password-submit'));

    expect(api.changePassword).toHaveBeenCalledTimes(1);

    // Let the held request finish inside `act`, so the state it settles is part
    // of the test rather than an update landing after it ends.
    await act(async () => {
      release();
    });
  });
});

describe('a throttled change (KMO-50 #5)', () => {
  function throttleError(retryAfterSeconds?: number): ApiError {
    return new ApiError({
      kind: 'rateLimited',
      status: 429,
      serverMessage: 'Too Many Attempts.',
      retryAfterSeconds,
    });
  }

  function throttledApi(retryAfterSeconds?: number): PasswordApi {
    return fakeApi({
      changePassword: jest.fn(async () => {
        throw throttleError(retryAfterSeconds);
      }),
    });
  }

  // The failure this criterion exists for. `ams` throttles this endpoint at
  // 6/minute, and a 429 has no `errors.current_password` in it — reporting it
  // under that field would tell an employee they mistyped a password they got
  // right, and send them looking for a mistake that is not there.
  it('is not reported as a wrong current password', async () => {
    await render(<ChangePassword onDone={jest.fn()} api={throttledApi(45)} />);

    await fillAndSubmit();

    expect(screen.getByTestId('change-password-current').props['aria-invalid']).toBe(false);
    expect(screen.queryByText(WRONG_CURRENT)).not.toBeOnTheScreen();
  });

  it('never puts the server English on screen', async () => {
    await render(<ChangePassword onDone={jest.fn()} api={throttledApi(45)} />);

    await fillAndSubmit();

    expect(screen.getByTestId('change-password-error')).toBeOnTheScreen();
    expect(screen.queryByText('Too Many Attempts.')).not.toBeOnTheScreen();
  });

  it('names the wait and holds the submit', async () => {
    await render(<ChangePassword onDone={jest.fn()} api={throttledApi(45)} />);

    await fillAndSubmit();

    expect(screen.getByText(tooManyAttempts(45))).toBeOnTheScreen();
    expect(screen.getByTestId('change-password-submit')).toBeDisabled();
  });

  it('does not report the change as done', async () => {
    await render(<ChangePassword onDone={jest.fn()} api={throttledApi(45)} />);

    await fillAndSubmit();

    // The password did not change. Showing the success panel would tell the
    // employee to start using one that was never accepted.
    expect(screen.queryByTestId('change-password-success')).not.toBeOnTheScreen();
  });

  it('does not resubmit while the wait is running', async () => {
    const api = throttledApi(45);
    await render(<ChangePassword onDone={jest.fn()} api={api} />);

    await fillAndSubmit();
    expect(api.changePassword).toHaveBeenCalledTimes(1);

    await userEvent.setup().press(screen.getByTestId('change-password-submit'));

    expect(api.changePassword).toHaveBeenCalledTimes(1);
  });
});
