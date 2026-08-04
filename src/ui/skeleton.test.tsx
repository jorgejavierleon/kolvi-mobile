import { render, screen } from '@testing-library/react-native';

import { colors, radius } from '@/theme';

import { Skeleton } from './skeleton';

/**
 * A skeleton is deliberately hidden from the accessibility tree, and RNTL's
 * default queries filter exactly that out — so every lookup here has to opt back
 * in. The `stays out of the accessibility tree` case below is what makes that
 * filtering the point rather than an inconvenience.
 */
function skeleton() {
  return screen.getByTestId('skeleton', { includeHiddenElements: true });
}

describe('Skeleton', () => {
  it('is a tinted block on the border token, at radius-sm', async () => {
    await render(<Skeleton testID="skeleton" />);

    expect(skeleton()).toHaveStyle({
      backgroundColor: colors.border,
      borderRadius: radius.sm,
    });
  });

  it('fills the row and stands a line high unless told otherwise', async () => {
    await render(<Skeleton testID="skeleton" />);

    expect(skeleton()).toHaveStyle({ width: '100%' });
  });

  it('takes the shape of whatever it is standing in for', async () => {
    await render(<Skeleton testID="skeleton" height={44} width="60%" />);

    expect(skeleton()).toHaveStyle({ height: 44, width: '60%' });
  });

  it('stays out of the accessibility tree', async () => {
    // The screen it is on announces the load through its own live region. Nine
    // blocks each announcing themselves is what makes a loading screen unusable
    // with TalkBack on.
    await render(<Skeleton testID="skeleton" />);

    expect(skeleton()).toHaveProp('accessibilityElementsHidden', true);
    expect(skeleton()).toHaveProp('importantForAccessibility', 'no-hide-descendants');
  });

  it('carries no text, so no untranslated placeholder can reach a screen', async () => {
    await render(<Skeleton testID="skeleton" />);

    expect(skeleton()).toBeEmptyElement();
  });
});
