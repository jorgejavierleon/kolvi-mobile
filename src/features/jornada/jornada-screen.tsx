import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { useSession } from '@/features/auth/session';
import { es } from '@/i18n';
import { colors, spacing, typography } from '@/theme';
import { Card } from '@/ui/card';
import { Screen } from '@/ui/screen';
import { ScreenHeader } from '@/ui/screen-header';
import { SegmentedControl } from '@/ui/segmented-control';

import { Historial } from './historial';
import { Proximos } from './proximos';
import type { UpcomingShiftsApi } from './shifts-api';
import type { WorkdaysApi } from './workdays-api';

export type JornadaScreenProps = {
  /** Opens Mi perfil. The route supplies the navigation; this screen does none. */
  onOpenProfile: () => void;
  /** Injected in tests; the app uses the configured client. */
  api?: UpcomingShiftsApi;
  /** Injected in tests; the app uses the configured client. */
  workdaysApi?: WorkdaysApi;
};

type JornadaSegment = 'proximos' | 'historial';

/**
 * Jornada (KMO-32, KMO-33). The segmented control, Próximos and Historial are
 * real; KMO-34 is the day detail Historial's rows are wired for, and KMO-35
 * the pending-correction card that puts the count on this tab's badge.
 *
 * Gated on `ViewOwn:Workday` — unlike Marcaje's punch surface, there is
 * nothing on this whole tab for an employee who cannot view their own
 * workday, so the gate covers the segmented control too rather than just one
 * row inside it.
 */
export function JornadaScreen({ onOpenProfile, api, workdaysApi }: JornadaScreenProps) {
  const session = useSession();
  const [segment, setSegment] = useState<JornadaSegment>('proximos');

  const canView = session.can('ViewOwn:Workday');

  return (
    <Screen>
      <ScreenHeader
        title={es.headers.jornada}
        avatarLabel={es.profile.open}
        onPressAvatar={onOpenProfile}
      />

      {canView ? (
        <>
          <SegmentedControl
            segments={[
              { value: 'proximos', label: es.jornada.segments.proximos },
              { value: 'historial', label: es.jornada.segments.historial },
            ]}
            value={segment}
            onChange={setSegment}
            accessibilityLabel={es.headers.jornada}
            testID="jornada-segments"
            style={styles.segments}
          />

          {segment === 'proximos' ? <Proximos api={api} /> : <Historial api={workdaysApi} />}
        </>
      ) : (
        <Card testID="jornada-no-access">
          <Text style={styles.noAccess}>{es.jornada.noAccess}</Text>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  segments: {
    marginBottom: spacing[4],
  },
  noAccess: {
    ...typography.body,
    color: colors.textBody,
  },
});
