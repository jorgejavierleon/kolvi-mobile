import { render as rtlRender, screen } from '@testing-library/react-native';
import { type ReactElement } from 'react';
import { Text } from 'react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { colors } from '@/theme';

import { Screen } from './screen';

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 412, height: 892 },
  insets: { top: 24, left: 0, right: 0, bottom: 48 },
};

const render = (ui: ReactElement) =>
  rtlRender(ui, {
    wrapper: ({ children }: { children: ReactElement }) => (
      <SafeAreaProvider initialMetrics={metrics}>{children}</SafeAreaProvider>
    ),
  });

describe('Screen', () => {
  it('renders its content on the page tint', async () => {
    await render(
      <Screen testID="content">
        <Text>Mi jornada</Text>
      </Screen>,
    );

    expect(screen.getByText('Mi jornada')).toBeOnTheScreen();
    expect(screen.getByTestId('content').parent).toHaveStyle({
      backgroundColor: colors.surfacePage,
    });
  });

  it('renders a pinned header above the scroll area', async () => {
    await render(
      <Screen header={<Text>Mi perfil</Text>} testID="content">
        <Text>cuerpo</Text>
      </Screen>,
    );

    // Outside the scroll view, so it cannot scroll out of reach.
    expect(screen.getByText('Mi perfil')).toBeOnTheScreen();
    expect(screen.getByTestId('content')).not.toContainElement(screen.getByText('Mi perfil'));
  });

  // A tab screen leaves the bottom inset to the tab bar below it; a surface with
  // no tab bar under it — the profile — has to take it itself, or its last row
  // lands under the system navigation bar.
  //
  // Asserted on the edge set rather than on a resolved padding: the inset is
  // applied by the native view, so it never reaches the JS style object.
  it('leaves the bottom inset alone by default and takes it on request', async () => {
    await render(<Screen testID="content">{null}</Screen>);
    expect(screen.getByTestId('content').parent).toHaveProp(
      'edges',
      expect.objectContaining({ bottom: 'off' }),
    );

    await screen.rerender(
      <Screen bottomInset testID="content">
        {null}
      </Screen>,
    );
    expect(screen.getByTestId('content').parent).toHaveProp(
      'edges',
      expect.objectContaining({ bottom: 'additive' }),
    );
  });
});
