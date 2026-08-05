import { render, screen, userEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { es } from '@/i18n';
import { tones } from '@/theme';

import { LocationCard } from './location-card';
import type { LocationState } from './use-location';

const premise = 'Sucursal Ñuñoa';

function draw(state: LocationState, overrides: { premise?: string | null } = {}) {
  return render(
    <LocationCard
      state={state}
      premise={overrides.premise === undefined ? premise : overrides.premise}
      onEnable={() => {}}
      onOpenSettings={() => {}}
      testID="location-card"
    />,
  );
}

/** The card's own background, which is where the tone is applied. */
function cardTone() {
  return StyleSheet.flatten(screen.getByTestId('location-card').props.style).backgroundColor;
}

describe('the confirmed state (#2)', () => {
  it('names the premise and the distance on the success tint', async () => {
    await draw({ kind: 'confirmed', distanceMeters: 12 });

    expect(screen.getByText('Ubicación confirmada')).toBeOnTheScreen();
    expect(screen.getByText('Sucursal Ñuñoa · a 12 m de la marca')).toBeOnTheScreen();
    expect(cardTone()).toBe(tones.success.background);
  });

  // #6, on screen: a premise with no geofence still confirms, with nothing said
  // about a distance nobody measured.
  it('keeps the title and drops the distance when there is none', async () => {
    await draw({ kind: 'confirmed', distanceMeters: null });

    expect(screen.getByText('Ubicación confirmada')).toBeOnTheScreen();
    expect(screen.getByText('Sucursal Ñuñoa')).toBeOnTheScreen();
  });

  it('says nothing about a place on a day with no shift', async () => {
    await draw({ kind: 'confirmed', distanceMeters: null }, { premise: null });

    expect(screen.getByText('Ubicación confirmada')).toBeOnTheScreen();
    expect(screen.queryByText(premise)).not.toBeOnTheScreen();
  });
});

describe('the out-of-range state (#3)', () => {
  it('names the premise the employee has to be inside of, on the warning tint', async () => {
    await draw({ kind: 'outside', distanceMeters: 400 });

    expect(screen.getByText('Fuera del rango permitido')).toBeOnTheScreen();
    expect(screen.getByText('Debes estar dentro de Sucursal Ñuñoa para marcar')).toBeOnTheScreen();
    expect(cardTone()).toBe(tones.warning.background);
  });

  // D-F1-c: out of range is recorded and flagged, never blocked. The escape
  // hatch is KMO-18's, under the punch button, and it is not on this card.
  it('offers no action of its own', async () => {
    await draw({ kind: 'outside', distanceMeters: 400 });

    expect(screen.queryByTestId('location-settings')).not.toBeOnTheScreen();
  });
});

describe('the no-signal state (#4)', () => {
  it('tells them to turn location on, on the danger tint', async () => {
    await draw({ kind: 'noSignal' });

    expect(screen.getByText('Sin señal de GPS')).toBeOnTheScreen();
    expect(screen.getByText('Activa tu ubicación para poder marcar')).toBeOnTheScreen();
    expect(cardTone()).toBe(tones.danger.background);
  });
});

describe('the denied state (#8)', () => {
  it('offers the OS settings when there is no prompt left to raise', async () => {
    const onOpenSettings = jest.fn();

    await render(
      <LocationCard
        state={{ kind: 'denied', canAskAgain: false }}
        premise={premise}
        onEnable={() => {}}
        onOpenSettings={onOpenSettings}
        testID="location-card"
      />,
    );

    expect(screen.getByText('Sin permiso de ubicación')).toBeOnTheScreen();
    expect(screen.getByText(es.permissions.location.deniedForever)).toBeOnTheScreen();

    await userEvent.press(screen.getByTestId('location-settings'));

    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  // Sending someone into system settings for a permission the OS will still
  // prompt for is advice that costs them a trip out of the app for nothing.
  it('offers the prompt again while there is still one to raise', async () => {
    const onEnable = jest.fn();

    await render(
      <LocationCard
        state={{ kind: 'denied', canAskAgain: true }}
        premise={premise}
        onEnable={onEnable}
        onOpenSettings={() => {}}
        testID="location-card"
      />,
    );

    expect(screen.getByText(es.permissions.location.enable)).toBeOnTheScreen();
    expect(screen.queryByText(es.actions.openSettings)).not.toBeOnTheScreen();

    await userEvent.press(screen.getByTestId('location-settings'));

    expect(onEnable).toHaveBeenCalledTimes(1);
  });
});

describe('the seconds before any of them', () => {
  it('says it is looking rather than drawing an empty card', async () => {
    await draw({ kind: 'acquiring' });

    expect(screen.getByText(es.marcaje.location.acquiring)).toBeOnTheScreen();
    expect(cardTone()).toBe(tones.neutral.background);
  });
});

/**
 * #5, which is the criterion this file exists to hold.
 *
 * Colour is never the only difference between two states: every tint change is
 * accompanied by a different title, so the card reads correctly to an employee
 * who cannot tell the amber from the green, and in the direct sunlight these are
 * actually looked at in.
 */
describe('colour paired with text', () => {
  const states: LocationState[] = [
    { kind: 'acquiring' },
    { kind: 'confirmed', distanceMeters: 12 },
    { kind: 'outside', distanceMeters: 400 },
    { kind: 'noSignal' },
    { kind: 'denied', canAskAgain: false },
  ];

  it('gives every state a title of its own', async () => {
    const titles: string[] = [];

    for (const state of states) {
      const drawn = await draw(state);
      titles.push(screen.getByTestId('location-card-title').props.children as string);
      await drawn.unmount();
    }

    expect(new Set(titles).size).toBe(states.length);
  });

  it('gives every state an icon of its own', async () => {
    const icons: string[] = [];

    for (const state of states) {
      const drawn = await draw(state);
      // The SVG path geometry, which is what distinguishes one glyph from
      // another — a state that reused another's icon would collide here.
      icons.push(JSON.stringify(screen.getByTestId('location-card').toJSON()?.children?.[0]));
      await drawn.unmount();
    }

    expect(new Set(icons).size).toBe(states.length);
  });
});
