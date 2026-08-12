import { render, screen } from '@testing-library/react-native';

import { colors } from '@/theme';

import type { SessionUser } from '../auth/session-user';
import { IdentityHeader, initialsFrom } from './identity-header';

function user(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: 5,
    name: 'Camila Rojas',
    firstName: 'Camila',
    email: 'c.rojas@example.com',
    rut: '12345678-9',
    position: 'Operaria de Bodega',
    premise: 'Sucursal Ñuñoa',
    personalEmail: null,
    phone: null,
    supervisor: null,
    contractStartDate: null,
    permissions: new Set(),
    ...overrides,
  };
}

describe('initialsFrom', () => {
  it('takes the first letter of the first and last words', () => {
    expect(initialsFrom('Camila Rojas')).toBe('CR');
  });

  it('uppercases a lowercase name', () => {
    expect(initialsFrom('camila rojas')).toBe('CR');
  });

  it('draws one letter for a single-word name rather than doubling it', () => {
    expect(initialsFrom('Camila')).toBe('C');
  });

  it('ignores repeated whitespace between words', () => {
    expect(initialsFrom('  Camila   Rojas  ')).toBe('CR');
  });

  it('takes the first and the last of three or more words', () => {
    expect(initialsFrom('Camila Andrea Rojas')).toBe('CR');
  });
});

describe('IdentityHeader', () => {
  it('shows the initials, the full name and the position and premise', async () => {
    await render(<IdentityHeader user={user()} />);

    expect(screen.getByText('CR')).toBeOnTheScreen();
    expect(screen.getByText('Camila Rojas')).toBeOnTheScreen();
    expect(screen.getByText('Operaria de Bodega · Sucursal Ñuñoa')).toBeOnTheScreen();
  });

  it('draws the initials white over the primary-coloured avatar', async () => {
    await render(<IdentityHeader user={user()} />);

    expect(screen.getByText('CR')).toHaveStyle({ color: colors.white });
    expect(screen.getByTestId('profile-avatar')).toHaveStyle({ backgroundColor: colors.primary });
  });

  it('shows only the position when there is no premise', async () => {
    await render(<IdentityHeader user={user({ premise: null })} />);

    expect(screen.getByText('Operaria de Bodega')).toBeOnTheScreen();
  });

  it('shows only the premise when there is no position', async () => {
    await render(<IdentityHeader user={user({ position: null })} />);

    expect(screen.getByText('Sucursal Ñuñoa')).toBeOnTheScreen();
  });

  it('draws neither line when the employee has no position and no premise', async () => {
    await render(<IdentityHeader user={user({ position: null, premise: null })} />);

    expect(screen.queryByText('·', { exact: false })).toBeNull();
  });
});
