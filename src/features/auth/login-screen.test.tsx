import { act, render, screen, userEvent, waitFor } from '@testing-library/react-native';

import { ApiError } from '@/api';
import { es } from '@/i18n';

import type { AuthApi } from './auth-api';
import { LoginScreen } from './login-screen';
import { parsePermissions } from './permissions';
import type { SessionUser } from './session-user';
import { SessionProvider } from './session';
import { createMemoryTokenStore } from './token-store';

/** The two sentences `ams` returns, from `lang/es/auth.php`. */
const CREDENTIALS_REJECTED = 'Estas credenciales no coinciden con nuestros registros.';
const ACCOUNT_INACTIVE = 'Esta cuenta está inactiva.';

const employee: SessionUser = {
  id: 3,
  name: 'Empleado Demo',
  firstName: 'Empleado',
  email: 'employee@example.com',
  rut: '21437581-8',
  permissions: parsePermissions(['ClockOwn:Mark']),
};

function rejectionError(message: string): ApiError {
  return new ApiError({
    kind: 'validation',
    status: 422,
    serverMessage: message,
    fieldErrors: { email: [message] },
  });
}

function fakeAuthApi(overrides: Partial<AuthApi> = {}): AuthApi {
  return {
    issueToken: jest.fn(async () => 'tok_abc'),
    fetchSessionUser: jest.fn(async () => employee),
    ...overrides,
  };
}

async function mount(authApi: AuthApi = fakeAuthApi()) {
  const view = await render(
    <SessionProvider
      authApi={authApi}
      tokenStore={createMemoryTokenStore()}
      deviceName={async () => 'Kolvi test'}
    >
      <LoginScreen />
    </SessionProvider>,
  );

  // The provider asks the store for a token before anything can be typed.
  await waitFor(() => expect(screen.getByTestId('login-submit')).toBeOnTheScreen());

  return { ...view, authApi };
}

async function signIn(user: ReturnType<typeof userEvent.setup>, password = 'admin') {
  await user.type(screen.getByTestId('login-email'), 'employee@example.com');
  await user.type(screen.getByTestId('login-password'), password);
  await user.press(screen.getByTestId('login-submit'));
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });

  return { promise, resolve };
}

describe('the login screen', () => {
  // #1 — both fields and the action, in Spanish, from the catalogue.
  it('collects an email and a password', async () => {
    await mount();

    expect(screen.getByText(es.auth.heading)).toBeOnTheScreen();
    expect(screen.getByLabelText(es.auth.email)).toBeOnTheScreen();
    expect(screen.getByLabelText(es.auth.password)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: es.auth.submit })).toBeOnTheScreen();
  });

  // #7 — masked, with a toggle that renames itself.
  it('masks the password and offers a reveal toggle', async () => {
    const user = userEvent.setup();
    await mount();

    expect(screen.getByTestId('login-password')).toHaveProp('secureTextEntry', true);

    await user.press(screen.getByLabelText(es.auth.showPassword));

    expect(screen.getByTestId('login-password')).toHaveProp('secureTextEntry', false);
    expect(screen.getByLabelText(es.auth.hidePassword)).toBeOnTheScreen();
  });

  it('asks for the fields it needs before spending a round trip', async () => {
    const user = userEvent.setup();
    const { authApi } = await mount();

    await user.press(screen.getByTestId('login-submit'));

    expect(screen.getByText(es.auth.emailRequired)).toBeOnTheScreen();
    expect(screen.getByText(es.auth.passwordRequired)).toBeOnTheScreen();
    expect(authApi.issueToken).not.toHaveBeenCalled();
  });

  // #3 — the credentials leave the screen; landing on Marcaje is the navigator's
  // half of the criterion and is covered on a device.
  it('signs in with the trimmed email and the password as typed', async () => {
    const user = userEvent.setup();
    const { authApi } = await mount();

    await user.type(screen.getByTestId('login-email'), '  employee@example.com  ');
    await user.type(screen.getByTestId('login-password'), ' admin ');
    await user.press(screen.getByTestId('login-submit'));

    await waitFor(() =>
      expect(authApi.issueToken).toHaveBeenCalledWith(
        { email: 'employee@example.com', password: ' admin ' },
        'Kolvi test',
      ),
    );
  });

  describe('a rejected login', () => {
    // #4 — verbatim, and with no retry: the server decided, so pressing the same
    // button with the same values would only be told the same thing again.
    it.each([
      ['wrong credentials', CREDENTIALS_REJECTED],
      ['a deactivated account', ACCOUNT_INACTIVE],
    ])('shows the server sentence for %s', async (_label, sentence) => {
      const user = userEvent.setup();
      await mount(
        fakeAuthApi({
          issueToken: jest.fn(async () => {
            throw rejectionError(sentence);
          }),
        }),
      );

      await signIn(user);

      await waitFor(() => expect(screen.getByText(sentence)).toBeOnTheScreen());
      expect(screen.queryByTestId('login-retry')).not.toBeOnTheScreen();
    });

    it('tells the two rejections apart', async () => {
      expect(CREDENTIALS_REJECTED).not.toBe(ACCOUNT_INACTIVE);

      const user = userEvent.setup();
      await mount(
        fakeAuthApi({
          issueToken: jest.fn(async () => {
            throw rejectionError(ACCOUNT_INACTIVE);
          }),
        }),
      );

      await signIn(user);

      await waitFor(() => expect(screen.getByText(ACCOUNT_INACTIVE)).toBeOnTheScreen());
      expect(screen.queryByText(CREDENTIALS_REJECTED)).not.toBeOnTheScreen();
    });

    it('announces the failure rather than only colouring it', async () => {
      const user = userEvent.setup();
      await mount(
        fakeAuthApi({
          issueToken: jest.fn(async () => {
            throw rejectionError(CREDENTIALS_REJECTED);
          }),
        }),
      );

      await signIn(user);

      await waitFor(() => expect(screen.getByTestId('login-error')).toBeOnTheScreen());
      expect(screen.getByTestId('login-error')).toHaveProp('accessibilityLiveRegion', 'polite');
    });
  });

  describe('a login that never reached the server', () => {
    // #5 — different copy from a rejection, and a retry beside it.
    it('says the connection failed and offers a retry', async () => {
      const user = userEvent.setup();
      await mount(
        fakeAuthApi({
          issueToken: jest.fn(async () => {
            throw new ApiError({ kind: 'network' });
          }),
        }),
      );

      await signIn(user);

      await waitFor(() => expect(screen.getByText(es.errors.network)).toBeOnTheScreen());
      expect(screen.getByRole('button', { name: es.actions.retry })).toBeOnTheScreen();
      expect(screen.queryByText(CREDENTIALS_REJECTED)).not.toBeOnTheScreen();
    });

    it('retries with the values already typed', async () => {
      const user = userEvent.setup();
      const issueToken = jest
        .fn<Promise<string>, [unknown, string]>()
        .mockRejectedValueOnce(new ApiError({ kind: 'network' }))
        .mockResolvedValueOnce('tok_abc');
      const { authApi } = await mount(fakeAuthApi({ issueToken }));

      await signIn(user);
      await waitFor(() => expect(screen.getByTestId('login-retry')).toBeOnTheScreen());

      await user.press(screen.getByTestId('login-retry'));

      await waitFor(() => expect(authApi.fetchSessionUser).toHaveBeenCalledWith('tok_abc'));
      expect(issueToken).toHaveBeenCalledTimes(2);
      expect(issueToken.mock.calls[1]?.[0]).toEqual({
        email: 'employee@example.com',
        password: 'admin',
      });
    });

    it('clears the failure when the employee tries again', async () => {
      const user = userEvent.setup();
      const issueToken = jest
        .fn<Promise<string>, [unknown, string]>()
        .mockRejectedValueOnce(new ApiError({ kind: 'network' }))
        .mockResolvedValueOnce('tok_abc');
      await mount(fakeAuthApi({ issueToken }));

      await signIn(user);
      await waitFor(() => expect(screen.getByText(es.errors.network)).toBeOnTheScreen());

      await user.press(screen.getByTestId('login-retry'));

      await waitFor(() => expect(screen.queryByText(es.errors.network)).not.toBeOnTheScreen());
    });
  });

  // #6 — the criterion, both halves.
  describe('while the request is in flight', () => {
    it('shows the button as busy and blocks a second press', async () => {
      const user = userEvent.setup();
      const pending = deferred<string>();
      const issueToken = jest.fn(() => pending.promise);
      await mount(fakeAuthApi({ issueToken }));

      await signIn(user);

      await waitFor(() => expect(screen.getByTestId('login-submit')).toBeBusy());
      expect(
        screen.getByTestId('button-spinner', { includeHiddenElements: true }),
      ).toBeOnTheScreen();

      await user.press(screen.getByTestId('login-submit'));
      await user.press(screen.getByTestId('login-submit'));

      expect(issueToken).toHaveBeenCalledTimes(1);

      await act(async () => {
        pending.resolve('tok_abc');
      });
    });

    it('lets the employee try again once it has finished', async () => {
      const user = userEvent.setup();
      const issueToken = jest
        .fn<Promise<string>, [unknown, string]>()
        .mockRejectedValue(new ApiError({ kind: 'network' }));
      await mount(fakeAuthApi({ issueToken }));

      await signIn(user);
      await waitFor(() => expect(screen.getByTestId('login-submit')).not.toBeBusy());

      await user.press(screen.getByTestId('login-submit'));

      await waitFor(() => expect(issueToken).toHaveBeenCalledTimes(2));
    });
  });
});
