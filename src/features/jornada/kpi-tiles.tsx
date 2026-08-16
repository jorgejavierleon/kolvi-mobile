import { StyleSheet, Text, View } from 'react-native';

import { es, timeRange } from '@/i18n';
import { colors, spacing, tones, typography } from '@/theme';
import { Card } from '@/ui/card';

export type KpiTilesProps = {
  workedTime: string | null;
  extraTime: string | null;
  missingTime: string | null;
  /** `null` exactly when that punch itself is missing (#6) — read as `—`, not omitted. */
  markInTime: string | null;
  markOutTime: string | null;
};

const missingPunch = '—';

/**
 * The day-detail screen's four KPI tiles (KMO-34 #2): Trabajado, Tiempo
 * extra and Faltante in the design's own 2x2 grid, plus a combined Entrada /
 * Salida tile — one tile, not two, because the design draws the pair as a
 * single `HH:MM – HH:MM` value rather than as two more tiles.
 *
 * Each tile is its own `Card`, per `Card`'s own padded default — the design
 * draws four separate raised surfaces, not one card with four cells.
 */
export function KpiTiles({
  workedTime,
  extraTime,
  missingTime,
  markInTime,
  markOutTime,
}: KpiTilesProps) {
  return (
    <View style={styles.grid} testID="kpi-tiles">
      <Tile label={es.jornada.historial.worked} value={workedTime ?? missingPunch} />
      <Tile label={es.jornada.dayDetail.extra} value={extraTime ?? missingPunch} />
      <Tile
        label={es.jornada.historial.missing}
        value={missingTime ?? missingPunch}
        valueColor={tones.danger.foreground}
      />
      <Tile
        label={es.jornada.dayDetail.entradaSalida}
        value={timeRange(markInTime ?? missingPunch, markOutTime ?? missingPunch)}
        small
      />
    </View>
  );
}

function Tile({
  label,
  value,
  valueColor = colors.textHeading,
  small = false,
}: {
  label: string;
  value: string;
  valueColor?: string;
  small?: boolean;
}) {
  return (
    <Card
      accessible
      accessibilityLabel={`${label} ${value}`}
      style={styles.tile}
      testID={`kpi-tile-${label}`}
    >
      <Text style={styles.label}>{label}</Text>
      <Text style={[small ? styles.smallValue : styles.value, { color: valueColor }]}>{value}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
  },
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
  },
  label: {
    ...typography.eyebrow,
    color: colors.textMuted,
  },
  value: {
    ...typography.h2,
    marginTop: spacing[1],
  },
  smallValue: {
    ...typography.h3,
    marginTop: spacing[1] + 2,
  },
});
