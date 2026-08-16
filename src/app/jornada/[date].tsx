import { router, useLocalSearchParams } from 'expo-router';

import { naiveDate } from '@/api';
import { DayDetailScreen } from '@/features/jornada/day-detail-screen';
import { es, formatShortDate } from '@/i18n';
import { OverlayHeader } from '@/ui/overlay-header';
import { Screen } from '@/ui/screen';

/**
 * The day-detail screen a Historial row opens (KMO-33 #7, KMO-34) — a pushed
 * route rather than the `DayDetailPlaceholder` sheet it replaces, following
 * the same flat `src/app/` pattern as `mis-datos.tsx`: no tab bar under it,
 * so `Screen` takes the bottom inset itself.
 */
export default function DayDetailRoute() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const naive = naiveDate(date);

  return (
    <Screen
      bottomInset
      header={
        <OverlayHeader
          title={formatShortDate(naive)}
          backLabel={es.jornada.dayDetail.back}
          onBack={() => router.back()}
        />
      }
    >
      <DayDetailScreen date={naive} />
    </Screen>
  );
}
