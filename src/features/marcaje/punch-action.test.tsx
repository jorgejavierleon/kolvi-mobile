import { render, screen, userEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { es } from '@/i18n';
import { colors, hitTargetMin, shadows, tones, typography } from '@/theme';

import { PunchAction, type PunchHold } from './punch-action';
import type { PunchState } from './punch-state';
import type { PunchAttempt } from './use-punch';

const idle: PunchAttempt = { status: 'idle' };

function draw(
  state: PunchState | null,
  overrides: { attempt?: PunchAttempt; onPunch?: () => void; hold?: PunchHold | null } = {},
) {
  return render(
    <PunchAction
      state={state}
      attempt={overrides.attempt ?? idle}
      onPunch={overrides.onPunch ?? (() => {})}
      hold={overrides.hold}
      testID="punch-action"
    />,
  );
}

/** The two holds, with their actions stubbed. KMO-18 #1 and #3. */
const outside = (onOverride: () => void = () => {}): PunchHold => ({ kind: 'outside', onOverride });

const noSignal = (onRetry: () => void = () => {}, retrying = false): PunchHold => ({
  kind: 'noSignal',
  onRetry,
  retrying,
});

/** The spinner sits outside the accessibility tree, so it is asked for by id. */
const spinner = () => screen.queryByTestId('button-spinner', { includeHiddenElements: true });

function buttonStyle() {
  return StyleSheet.flatten(screen.getByTestId('punch-button').props.style);
}

// #1. Goal G1 is ten seconds from app open to a punch at p90, and this is the
// control that has to be found and hit without looking.
describe('the primary button', () => {
  it('is full width, at least 64dp tall, coral and set in the display font', async () => {
    await draw('before');

    const style = buttonStyle();

    expect(style.width).toBe('100%');
    expect(style.minHeight).toBeGreaterThanOrEqual(64);
    expect(style.backgroundColor).toBe(colors.accentCoral);
    expect(screen.getByText('Marcar entrada')).toHaveStyle({
      fontFamily: typography.h3.fontFamily,
      color: colors.white,
    });
  });

  it('carries the design’s coral glow, so it reads as the one action on the screen', async () => {
    await draw('before');

    expect(buttonStyle().boxShadow).toBe(shadows.accent.boxShadow);
  });

  it('shows a spinner while the punch is in flight, and keeps its label', async () => {
    await draw('before', { attempt: { status: 'submitting' } });

    expect(spinner()).toBeOnTheScreen();
    expect(screen.getByText('Marcar entrada')).toBeOnTheScreen();
  });

  it('shows no spinner when it is idle', async () => {
    await draw('before');

    expect(spinner()).toBeNull();
  });

  it('punches when pressed', async () => {
    const onPunch = jest.fn();
    await draw('before', { onPunch });

    await userEvent.press(screen.getByTestId('punch-button'));

    expect(onPunch).toHaveBeenCalledTimes(1);
  });

  // #6, on screen. The hook holds the second request; the button holds the
  // second *press*, so the two guards are independent.
  it('does not punch again while it is already punching', async () => {
    const onPunch = jest.fn();
    await draw('before', { attempt: { status: 'submitting' }, onPunch });

    await userEvent.press(screen.getByTestId('punch-button'));

    expect(onPunch).not.toHaveBeenCalled();
  });

  // The glow is the button's own colour thrown onto the page. Under a control
  // that will not respond it would be the dimming saying one thing and the
  // elevation another — the design drops it to `transparent` there too.
  it('drops the glow when it is held', async () => {
    await draw('before', { hold: outside() });

    expect(buttonStyle().boxShadow).toBeUndefined();
  });
});

/**
 * KMO-18. The two escape hatches, and the rule they exist to keep: a punch is
 * never *unavailable*, only ever held behind something the employee can act on
 * (docs/design-decisions.md D-F1-c).
 */
describe('the escape hatches under a held button', () => {
  // #1
  describe('out of range', () => {
    it('disables the primary and offers the override with its consequence in the label', async () => {
      await draw('before', { hold: outside() });

      expect(screen.getByTestId('punch-button')).toBeDisabled();
      expect(
        screen.getByText('Marcar de todas formas (queda pendiente de revisión)'),
      ).toBeOnTheScreen();
    });

    // The action the employee cannot take stays legible. An employee outside the
    // geofence has to see that punching is what they are being held back from.
    it('keeps the primary on screen and readable rather than hiding it', async () => {
      await draw('before', { hold: outside() });

      expect(screen.getByText('Marcar entrada')).toBeOnTheScreen();
    });

    // #2's client half. The override is the same punch, made deliberately —
    // there is no second request and no extra flag: `geo_status` already travels
    // as `outside` and the server runs its own haversine.
    it('records a punch through the same action the primary would have called', async () => {
      const onPunch = jest.fn();
      await draw('before', { hold: outside(onPunch) });

      await userEvent.press(screen.getByTestId('punch-override'));

      expect(onPunch).toHaveBeenCalledTimes(1);
    });

    it('is drawn in the warning tone the card above it is tinted with', async () => {
      await draw('before', { hold: outside() });

      expect(StyleSheet.flatten(screen.getByTestId('punch-override').props.style).borderColor).toBe(
        tones.warning.foreground,
      );
    });

    it('offers no location retry — the phone answered, the answer is the problem', async () => {
      await draw('before', { hold: outside() });

      expect(screen.queryByTestId('location-retry')).toBeNull();
    });
  });

  // #3, #4
  describe('no signal', () => {
    it('disables the primary and offers Reintentar ubicación', async () => {
      await draw('before', { hold: noSignal() });

      expect(screen.getByTestId('punch-button')).toBeDisabled();
      expect(screen.getByText('Reintentar ubicación')).toBeOnTheScreen();
    });

    it('asks the phone again when pressed', async () => {
      const onRetry = jest.fn();
      await draw('before', { hold: noSignal(onRetry) });

      await userEvent.press(screen.getByTestId('location-retry'));

      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    // #4. It spins in place rather than disappearing: a control that vanishes
    // the instant it is pressed reads as a tap that did nothing.
    it('spins in place while the fix is being re-acquired, keeping its label', async () => {
      await draw('before', { hold: noSignal(() => {}, true) });

      expect(screen.getByTestId('location-retry')).toBeOnTheScreen();
      expect(screen.getByText('Reintentar ubicación')).toBeOnTheScreen();
      expect(spinner()).toBeOnTheScreen();
    });

    it('does not ask the phone twice while it is still answering', async () => {
      const onRetry = jest.fn();
      await draw('before', { hold: noSignal(onRetry, true) });

      await userEvent.press(screen.getByTestId('location-retry'));

      expect(onRetry).not.toHaveBeenCalled();
    });

    it('offers no override — there is no verdict to override', async () => {
      await draw('before', { hold: noSignal() });

      expect(screen.queryByTestId('punch-override')).toBeNull();
    });
  });

  // #6, and the states the design gives no escape hatch to at all. `acquiring`
  // and `denied` both reach the screen with `hold` null: the first because a fix
  // is seconds away and the second because no fix is ever coming, so the punch
  // goes with `geo_status: unknown` rather than being held (KMO-17 #11).
  it('shows neither button, and no held primary, when nothing is holding it', async () => {
    await draw('before');

    expect(screen.queryByTestId('punch-override')).toBeNull();
    expect(screen.queryByTestId('location-retry')).toBeNull();
    expect(screen.getByTestId('punch-button')).toBeEnabled();
  });

  // #7. The floor comes from `size="sm"`, whose height *is* `hitTargetMin`, so
  // neither button can drift below it by carrying a number of its own.
  it.each(['punch-override', 'location-retry'])('gives %s the minimum hit target', async (id) => {
    await draw('before', { hold: id === 'punch-override' ? outside() : noSignal() });

    const style = StyleSheet.flatten(screen.getByTestId(id).props.style);

    expect(style.minHeight).toBeGreaterThanOrEqual(hitTargetMin);
    expect(style.width).toBe('100%');
  });

  // The one thing that must never happen: a disabled punch button with nothing
  // under it. `hold` carries the escape hatch, so this is the type system's job
  // — but the day it stops being, this test is what says so.
  it('never disables the primary without rendering a way past it', async () => {
    for (const hold of [outside(), noSignal()]) {
      await draw('before', { hold });

      expect(screen.getByTestId('punch-button')).toBeDisabled();
      expect(
        screen.queryByTestId('punch-override') ?? screen.queryByTestId('location-retry'),
      ).toBeOnTheScreen();
    }
  });

  // #6, from the other side: a finished day has no button for an escape hatch to
  // sit under, and a hold left over from a card above must not resurrect one.
  it('renders no escape hatch on a day that is already closed', async () => {
    await draw('done', { hold: outside() });

    expect(screen.queryByTestId('punch-override')).toBeNull();
    expect(screen.queryByTestId('punch-button')).toBeNull();
    expect(screen.getByTestId('punch-action-done')).toBeOnTheScreen();
  });

  // The disabled button says why, for an employee who cannot see the card.
  it('explains the hold on the button itself', async () => {
    await draw('before', { hold: outside() });

    expect(screen.getByTestId('punch-button')).toHaveProp(
      'accessibilityHint',
      es.marcaje.location.outside,
    );

    await draw('before', { hold: noSignal() });

    expect(screen.getByTestId('punch-button')).toHaveProp(
      'accessibilityHint',
      es.marcaje.location.noSignal,
    );
  });
});

// #2. The button and the status line above it read from the same three states,
// so the pair cannot say `En jornada` over `Marcar entrada`.
describe('the three states', () => {
  it('offers entrada before the day has started', async () => {
    await draw('before');

    expect(screen.getByText('Marcar entrada')).toBeOnTheScreen();
  });

  it('offers salida during it', async () => {
    await draw('working');

    expect(screen.getByText('Marcar salida')).toBeOnTheScreen();
  });

  it('shows nothing at all when nobody has said what the day looks like', async () => {
    await draw(null);

    expect(screen.queryByTestId('punch-button')).toBeNull();
    expect(screen.queryByTestId('punch-action-done')).toBeNull();
  });
});

// #3. The finished day does not disable the button — it replaces it. A day that
// is over still offering to end is the state the design draws around.
describe('the success panel', () => {
  it('stands where the button was, and the button is gone', async () => {
    await draw('done');

    expect(screen.queryByTestId('punch-button')).toBeNull();
    expect(screen.getByTestId('punch-action-done')).toBeOnTheScreen();
  });

  it('reads Jornada finalizada over Nos vemos en tu próximo turno', async () => {
    await draw('done');

    expect(screen.getByText('Jornada finalizada')).toBeOnTheScreen();
    expect(screen.getByText('Nos vemos en tu próximo turno')).toBeOnTheScreen();
  });

  it('is drawn on the success tint', async () => {
    await draw('done');

    expect(
      StyleSheet.flatten(screen.getByTestId('punch-action-done').props.style).backgroundColor,
    ).toBe(tones.success.background);
  });

  // One spelling of the sentence. The status line under the clock says the same
  // words, from the same catalogue entry.
  it('titles itself from the same entry as the status line', async () => {
    await draw('done');

    expect(screen.getByText(es.marcaje.status.done)).toBeOnTheScreen();
  });
});

// #8. The employee has not lost their place: same state, same label, one line
// under it — and the button above is the retry.
describe('a punch that failed', () => {
  const failed: PunchAttempt = { status: 'failed', message: 'No pudimos registrar tu marca.' };

  it('keeps the button, its label and the state', async () => {
    await draw('before', { attempt: failed });

    expect(screen.getByTestId('punch-button')).toBeOnTheScreen();
    expect(screen.getByText('Marcar entrada')).toBeOnTheScreen();
  });

  it('says what happened under the button, on the danger tint', async () => {
    await draw('before', { attempt: failed });

    expect(screen.getByText('No pudimos registrar tu marca.')).toBeOnTheScreen();
    expect(StyleSheet.flatten(screen.getByTestId('punch-failed').props.style).backgroundColor).toBe(
      tones.danger.background,
    );
  });

  it('is still pressable, so the retry is the button itself', async () => {
    const onPunch = jest.fn();
    await draw('before', { attempt: failed, onPunch });

    await userEvent.press(screen.getByTestId('punch-button'));

    expect(onPunch).toHaveBeenCalledTimes(1);
  });
});

// #7. Never an error dialog: the register already holds the punch, which is news
// about the day rather than something that went wrong.
describe('a punch that already existed', () => {
  const duplicate: PunchAttempt = {
    status: 'duplicate',
    message: es.marcaje.punch.alreadyMarked,
  };

  it('renders as a line on the screen, with no dialog and no danger tint', async () => {
    await draw('working', { attempt: duplicate });

    expect(screen.getByText(es.marcaje.punch.alreadyMarked)).toBeOnTheScreen();
    expect(screen.queryByTestId('punch-failed')).toBeNull();
    expect(
      StyleSheet.flatten(screen.getByTestId('punch-duplicate').props.style).backgroundColor,
    ).not.toBe(tones.danger.background);
  });

  // The state the hook advanced to is already on screen behind the line: the
  // employee sees the day as it really is, and the line explains why it moved.
  it('shows the state the register is actually in', async () => {
    await draw('done', { attempt: duplicate });

    expect(screen.getByText('Jornada finalizada')).toBeOnTheScreen();
    expect(screen.getByText(es.marcaje.punch.alreadyMarked)).toBeOnTheScreen();
  });
});

// KMO-23. Not an error either: the punch was captured durably, it is simply
// not in the register yet, and the state has already moved to say so.
describe('a punch made with no connectivity', () => {
  const queued: PunchAttempt = { status: 'queued', message: es.marcaje.punch.queued };

  it('renders as a line on the screen, with no dialog and no danger tint', async () => {
    await draw('working', { attempt: queued });

    expect(screen.getByText(es.marcaje.punch.queued)).toBeOnTheScreen();
    expect(screen.queryByTestId('punch-failed')).toBeNull();
    expect(
      StyleSheet.flatten(screen.getByTestId('punch-queued').props.style).backgroundColor,
    ).not.toBe(tones.danger.background);
  });

  it('shows the state the hook advanced to, behind the line', async () => {
    await draw('done', { attempt: queued });

    expect(screen.getByText('Jornada finalizada')).toBeOnTheScreen();
    expect(screen.getByText(es.marcaje.punch.queued)).toBeOnTheScreen();
  });
});
