import { fireEvent, render, screen } from '@testing-library/react-native';
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
  it('shows every section heading and its first paragraph', async () => {
    await render(<HelpSupport />);

    for (const section of Object.values(strings.sections)) {
      expect(screen.getByText(section.title)).toBeOnTheScreen();
      expect(screen.getByText(section.body[0] as string)).toBeOnTheScreen();
    }
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
