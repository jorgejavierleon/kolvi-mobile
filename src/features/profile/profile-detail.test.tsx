import { render, screen } from '@testing-library/react-native';
import type { ReactTestRendererJSON } from 'react-test-renderer';

import { es } from '@/i18n';

import type { SessionUser } from '../auth/session-user';
import { ProfileDetail } from './profile-detail';

function user(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: 5,
    name: 'Camila Rojas',
    firstName: 'Camila',
    email: 'c.rojas@example.com',
    rut: '12345678-9',
    position: 'Operaria de Bodega',
    premise: 'Sucursal Ñuñoa',
    personalEmail: 'camila.personal@example.com',
    phone: '+56 9 1234 5678',
    supervisor: 'Supervisor Demo',
    contractStartDate: '2024-03-01',
    permissions: new Set(),
    ...overrides,
  };
}

const fields = es.profile.misDatos.fields;

describe('ProfileDetail', () => {
  it('shows every field the server returned', async () => {
    await render(<ProfileDetail user={user()} />);

    expect(screen.getByText(fields.name)).toBeOnTheScreen();
    expect(screen.getByText('Camila Rojas')).toBeOnTheScreen();

    expect(screen.getByText(fields.rut)).toBeOnTheScreen();
    expect(screen.getByText('12.345.678-9')).toBeOnTheScreen();

    expect(screen.getByText(fields.corporateEmail)).toBeOnTheScreen();
    expect(screen.getByText('c.rojas@example.com')).toBeOnTheScreen();

    expect(screen.getByText(fields.personalEmail)).toBeOnTheScreen();
    expect(screen.getByText('camila.personal@example.com')).toBeOnTheScreen();

    expect(screen.getByText(fields.phone)).toBeOnTheScreen();
    expect(screen.getByText('+56 9 1234 5678')).toBeOnTheScreen();

    expect(screen.getByText(fields.position)).toBeOnTheScreen();
    expect(screen.getByText('Operaria de Bodega')).toBeOnTheScreen();

    expect(screen.getByText(fields.premise)).toBeOnTheScreen();
    expect(screen.getByText('Sucursal Ñuñoa')).toBeOnTheScreen();

    expect(screen.getByText(fields.supervisor)).toBeOnTheScreen();
    expect(screen.getByText('Supervisor Demo')).toBeOnTheScreen();

    expect(screen.getByText(fields.contractStart)).toBeOnTheScreen();
    expect(screen.getByText('1 de marzo 2024')).toBeOnTheScreen();
  });

  it.each<[string, Partial<SessionUser>, string]>([
    ['rut', { rut: null }, fields.rut],
    ['phone', { phone: null }, fields.phone],
    ['position', { position: null }, fields.position],
    ['premise', { premise: null }, fields.premise],
    ['supervisor', { supervisor: null }, fields.supervisor],
    ['contract start date', { contractStartDate: null }, fields.contractStart],
  ])('omits the %s row rather than showing it blank', async (_label, overrides, label) => {
    await render(<ProfileDetail user={user(overrides)} />);

    expect(screen.queryByText(label)).toBeNull();
  });

  it('omits a rut that does not match the shape formatRut expects, rather than crashing', async () => {
    await render(<ProfileDetail user={user({ rut: 'not-a-rut' })} />);

    expect(screen.queryByText(fields.rut)).toBeNull();
  });

  it('omits a contract start date that is not a naive YYYY-MM-DD string', async () => {
    await render(<ProfileDetail user={user({ contractStartDate: '2024-03-01T00:00:00Z' })} />);

    expect(screen.queryByText(fields.contractStart)).toBeNull();
  });

  it('prompts for a personal email when the employee has none', async () => {
    await render(<ProfileDetail user={user({ personalEmail: null })} />);

    expect(screen.queryByText(fields.personalEmail)).toBeNull();
    expect(screen.getByText(es.profile.misDatos.noPersonalEmail)).toBeOnTheScreen();
  });

  it('does not prompt when a personal email is on file', async () => {
    await render(<ProfileDetail user={user()} />);

    expect(screen.queryByText(es.profile.misDatos.noPersonalEmail)).toBeNull();
  });

  it('renders no editable field, button or link anywhere on the screen', async () => {
    const { toJSON } = await render(<ProfileDetail user={user({ personalEmail: null })} />);

    expect(hostComponentTypes(toJSON())).not.toContain('TextInput');
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });
});

/** Every host component type in the rendered tree — this build has no `UNSAFE_queryByType`. */
function hostComponentTypes(
  json: ReactTestRendererJSON | ReactTestRendererJSON[] | null,
): string[] {
  if (json === null) {
    return [];
  }

  const nodes = Array.isArray(json) ? json : [json];

  return nodes.flatMap((node) => {
    const children = (node.children ?? []).filter(
      (child): child is ReactTestRendererJSON => typeof child !== 'string',
    );

    return [node.type, ...hostComponentTypes(children)];
  });
}
