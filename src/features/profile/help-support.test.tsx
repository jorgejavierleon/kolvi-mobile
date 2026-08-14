import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { es } from '@/i18n';

import { HelpSupport } from './help-support';

// appVersionLabel's own branches (with/without a build number) are
// strings.test.ts's; this only has to prove the two native values are wired
// into it, which the parenthetical case already shows for both at once.
jest.mock('expo-application', () => ({
  nativeApplicationVersion: '9.9.9',
  nativeBuildVersion: '42',
}));

const strings = es.profile.helpSupport;

describe('HelpSupport', () => {
  it('shows every section heading but hides its body by default', async () => {
    await render(<HelpSupport />);

    for (const section of Object.values(strings.sections)) {
      expect(screen.getByText(section.title)).toBeOnTheScreen();
      expect(screen.queryByText(section.body[0] as string)).not.toBeOnTheScreen();
    }
  });

  it('expands a section on press and collapses it again on a second press', async () => {
    await render(<HelpSupport />);

    const sections = Object.entries(strings.sections);
    const [firstKey, firstSection] = sections[0] as (typeof sections)[number];
    const [, otherSection] = sections[1] as (typeof sections)[number];
    const toggle = screen.getByTestId(`help-support-section-${firstKey}-toggle`);

    fireEvent.press(toggle);

    expect(await screen.findByText(firstSection.body[0] as string)).toBeOnTheScreen();
    expect(toggle).toHaveProp('accessibilityState', { expanded: true });
    // A sibling section stays untouched — this is an accordion where every
    // panel opens independently, not a single-open group.
    expect(screen.queryByText(otherSection.body[0] as string)).not.toBeOnTheScreen();

    fireEvent.press(toggle);

    await waitFor(() => {
      expect(screen.queryByText(firstSection.body[0] as string)).not.toBeOnTheScreen();
    });
    expect(toggle).toHaveProp('accessibilityState', { expanded: false });
  });

  it('shows the support contact row', async () => {
    await render(<HelpSupport />);

    expect(screen.getByText(strings.contact.action)).toBeOnTheScreen();
    expect(screen.getByText(strings.contact.email)).toBeOnTheScreen();
  });

  it('opens a mailto: link to the support address when the row is pressed', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);

    await render(<HelpSupport />);
    fireEvent.press(screen.getByTestId('help-support-contact'));

    expect(openURL).toHaveBeenCalledTimes(1);
    expect(openURL).toHaveBeenCalledWith(`mailto:${strings.contact.email}`);
  });

  it('shows the version and build number from expo-application', async () => {
    await render(<HelpSupport />);

    expect(screen.getByText('Versión 9.9.9 (42)')).toBeOnTheScreen();
  });
});
