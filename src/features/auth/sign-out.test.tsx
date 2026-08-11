import { act, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { es, unsyncedPunchesWarning } from '@/i18n';

import type { AuthApi } from './auth-api';
import { parsePermissions } from './permissions';
import type { SessionUser } from './session-user';
import { SessionProvider } from './session';
import { createMemoryTokenStore, type TokenStore } from './token-store';
import { SignOut } from './sign-out';

const employee: SessionUser = {
  id: 3,
  name: 'Empleado Demo',
  firstName: 'Empleado',
  email: 'employee@example.com',
  rut: '21437581-8',
  position: null,
  premise: null,
  permissions: parsePermissions(['ClockOwn:Mark']),
};

function fakeAuthApi(overrides: Partial<AuthApi> = {}): AuthApi {
  return {
    issueToken: jest.fn(async () => 'tok_abc'),
    fetchSessionUser: jest.fn(async () => employee),
    revokeToken: jest.fn(async () => true),
    ...overrides,
  };
}

/** A gesture-navigation Android phone, so the sheet's pinned footer has an inset to clear. */
const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 412, height: 892 },
  insets: { top: 24, left: 0, right: 0, bottom: 48 },
};

type MountOptions = { authApi?: AuthApi; pendingPunches?: number };

/** Signed in on a restored token, which is the only state Mi perfil is reachable from. */
async function mountSignedIn({ authApi = fakeAuthApi(), pendingPunches }: MountOptions = {}) {
  const tokenStore: TokenStore = createMemoryTokenStore();
  await tokenStore.write('tok_stored');

  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <SessionProvider
        authApi={authApi}
        tokenStore={tokenStore}
        deviceName={async () => 'Kolvi test'}
      >
        <SignOut pendingPunches={pendingPunches} />
      </SessionProvider>
    </SafeAreaProvider>,
  );

  await act(async () => {});

  return { authApi, tokenStore };
}

/**
 * Taps Cerrar sesión on the profile card, which should only ever open the sheet.
 *
 * `userEvent` rather than a bare `fireEvent.press`: the press mounts a `Modal`,
 * and an unwrapped press that inserts one detaches the renderer for every test
 * after it in this file. `bottom-sheet.test.tsx` reaches for `userEvent` for the
 * same reason.
 */
async function openTheSheet() {
  await press(screen.getByTestId('sign-out-action'));
}

/** Every press in this file goes through here, for the reason above. */
async function press(element: Parameters<ReturnType<typeof userEvent.setup>['press']>[0]) {
  await userEvent.setup().press(element);
}

describe('the Cerrar sesión row', () => {
  it('is on the profile surface, named in Spanish', async () => {
    await mountSignedIn();

    expect(screen.getByTestId('sign-out-action')).toBeTruthy();
    expect(screen.getByText(es.auth.signOut.action)).toBeTruthy();
  });

  // #2 — the criterion, and the one that matters most: a single tap must not be
  // able to end a session, because the queue it would drop is unrecoverable.
  it('ends nothing on its own', async () => {
    const { authApi, tokenStore } = await mountSignedIn();

    await openTheSheet();
    await act(async () => {});

    expect(authApi.revokeToken).not.toHaveBeenCalled();
    await expect(tokenStore.read()).resolves.toBe('tok_stored');
  });

  it('asks first, and says what signing out costs', async () => {
    await mountSignedIn();

    await openTheSheet();

    expect(await screen.findByText(es.auth.signOut.title)).toBeTruthy();
    expect(screen.getByText(es.auth.signOut.body)).toBeTruthy();
  });
});

describe('confirming', () => {
  it('revokes the token and ends the session', async () => {
    const { authApi, tokenStore } = await mountSignedIn();

    await openTheSheet();
    await press(await screen.findByTestId('sign-out-confirm-action'));

    await waitFor(() => expect(authApi.revokeToken).toHaveBeenCalledWith('tok_stored'));
    await waitFor(async () => expect(await tokenStore.read()).toBeNull());
  });

  // Cancelar is the escape hatch the confirmation exists for. If it left anything
  // behind, the sheet would be a warning that does not work.
  it('leaves the session untouched on Cancelar', async () => {
    const { authApi, tokenStore } = await mountSignedIn();

    await openTheSheet();
    await press(await screen.findByTestId('sign-out-cancel'));
    await act(async () => {});

    expect(screen.queryByText(es.auth.signOut.title)).toBeNull();
    expect(authApi.revokeToken).not.toHaveBeenCalled();
    await expect(tokenStore.read()).resolves.toBe('tok_stored');
  });

  it('treats the backdrop as Cancelar, never as consent', async () => {
    const { authApi } = await mountSignedIn();

    await openTheSheet();
    await press(await screen.findByTestId('bottom-sheet-backdrop'));
    await act(async () => {});

    expect(screen.queryByText(es.auth.signOut.title)).toBeNull();
    expect(authApi.revokeToken).not.toHaveBeenCalled();
  });

  // The revocation is a network round trip, and the sheet stays on screen for the
  // whole of it. An impatient second tap must not send a second DELETE carrying a
  // token the first one already killed.
  it('revokes once when the employee taps again while it is in flight', async () => {
    let finishRevoking = () => {};
    const authApi = fakeAuthApi({
      revokeToken: jest.fn(
        () =>
          new Promise<boolean>((resolve) => {
            finishRevoking = () => resolve(true);
          }),
      ),
    });
    const { tokenStore } = await mountSignedIn({ authApi });

    await openTheSheet();
    const confirm = await screen.findByTestId('sign-out-confirm-action');
    await press(confirm);
    await press(confirm);
    await press(confirm);

    expect(authApi.revokeToken).toHaveBeenCalledTimes(1);

    await act(async () => {
      finishRevoking();
    });
    await waitFor(async () => expect(await tokenStore.read()).toBeNull());
  });

  // Cancelar is disabled for the same window, so the sheet cannot be closed out
  // from under a sign-out that is already revoking.
  it('does not let Cancelar undo a sign-out already in flight', async () => {
    const authApi = fakeAuthApi({ revokeToken: jest.fn(() => new Promise<boolean>(() => {})) });
    await mountSignedIn({ authApi });

    await openTheSheet();
    await press(await screen.findByTestId('sign-out-confirm-action'));
    await press(screen.getByTestId('bottom-sheet-backdrop'));

    expect(screen.getByText(es.auth.signOut.title)).toBeTruthy();
  });
});

/**
 * #3. There is no queue to read yet — KMO-22 and KMO-23 build it — so the count
 * arrives as a prop from `src/app/perfil.tsx` and these are the only place the
 * warning is exercised until then.
 */
describe('with punches this phone has not synced', () => {
  it('names how many marks are about to be lost', async () => {
    await mountSignedIn({ pendingPunches: 2 });

    await openTheSheet();

    expect(await screen.findByTestId('sign-out-unsynced-warning')).toBeTruthy();
    expect(screen.getByText(unsyncedPunchesWarning(2))).toBeTruthy();
  });

  // The point of the criterion is *explicitly*: an employee reading this has to
  // learn that attendance records disappear, not that a session ends.
  it('says the marks are lost and will not reach the attendance record', () => {
    const warning = unsyncedPunchesWarning(2);

    expect(warning).toMatch(/2 marcas/);
    expect(warning).toMatch(/perderán/);
    expect(warning).toMatch(/registro de asistencia/);
  });

  it('reads correctly for a single mark', () => {
    expect(unsyncedPunchesWarning(1)).toMatch(/1 marca registrada/);
    expect(unsyncedPunchesWarning(1)).toMatch(/Se perderá /);
  });

  // Replaced rather than appended: an employee about to lose an attendance record
  // must not have to read past the ordinary wording to find that out.
  it('replaces the ordinary body instead of sitting under it', async () => {
    await mountSignedIn({ pendingPunches: 1 });

    await openTheSheet();

    await screen.findByTestId('sign-out-unsynced-warning');
    expect(screen.queryByText(es.auth.signOut.body)).toBeNull();
  });

  it('still requires the deliberate confirmation, not just an acknowledgement', async () => {
    const { authApi, tokenStore } = await mountSignedIn({ pendingPunches: 3 });

    await openTheSheet();
    await screen.findByTestId('sign-out-unsynced-warning');

    expect(authApi.revokeToken).not.toHaveBeenCalled();
    await expect(tokenStore.read()).resolves.toBe('tok_stored');
  });

  it('shows the ordinary body when the queue is empty', async () => {
    await mountSignedIn({ pendingPunches: 0 });

    await openTheSheet();

    expect(await screen.findByText(es.auth.signOut.body)).toBeTruthy();
    expect(screen.queryByTestId('sign-out-unsynced-warning')).toBeNull();
  });
});
