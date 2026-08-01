import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing, typography } from '@/theme';

import { BottomSheet } from './bottom-sheet';
import { Button } from './button';
import { Card } from './card';
import { SegmentedControl } from './segmented-control';
import { StatusBadge } from './status-badge';
import { TileRow } from './tile-row';

/**
 * Every primitive on one screen, reachable at `kolvi://gallery`.
 *
 * Temporary scaffolding, on the same footing as `placeholder-screen`: it exists
 * because two of KMO-3's criteria — the 44px hit targets and rendering at the
 * largest OS font scale — cannot be honestly signed off from Jest, and a flow
 * needs something real to drive. `flows/kmo-3-ui-primitives.yaml` is that flow.
 * KMO-30 deletes both this and the route that exposes it.
 *
 * The Spanish here is lifted from the design so the screenshots are comparable
 * to it. It is scaffolding copy, not app copy, and never reaches `src/i18n`.
 */
export function Gallery() {
  const [tab, setTab] = useState<'proximos' | 'historial'>('proximos');
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Primitivas</Text>

        <Text style={styles.section}>Button</Text>
        <View style={styles.stack}>
          <Button label="Marcar entrada" variant="accent" size="lg" onPress={() => {}} />
          <Button label="Listo" onPress={() => setSheetOpen(true)} />
          <Button label="Reintentar ubicación" variant="secondary" onPress={() => {}} />
          <Button label="Rechazar" variant="danger" onPress={() => {}} />
          <Button label="Sincronizar" size="sm" onPress={() => {}} />
          <Button label="Guardando marca" onPress={() => {}} loading />
          <Button label="Marcar salida" onPress={() => {}} disabled />
        </View>

        <Text style={styles.section}>SegmentedControl</Text>
        <SegmentedControl
          accessibilityLabel="Vista de jornada"
          segments={[
            { value: 'proximos', label: 'Próximos' },
            { value: 'historial', label: 'Historial' },
          ]}
          value={tab}
          onChange={setTab}
        />

        <Text style={styles.section}>StatusBadge</Text>
        <View style={styles.row}>
          <StatusBadge label="Completo" tone="success" />
          <StatusBadge label="Atrasado" tone="warning" />
          <StatusBadge label="Ausente" tone="danger" />
          <StatusBadge label="Con permiso" tone="neutral" />
        </View>

        <Text style={styles.section}>Card + TileRow</Text>
        <Card>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Vie 24 jul</Text>
            <StatusBadge label="Completo" tone="success" />
          </View>
          <TileRow
            tiles={[
              { label: 'Trabajado', value: '08:00' },
              { label: 'Extra', value: '00:03' },
              { label: 'Faltante', value: '00:00' },
            ]}
          />
        </Card>
      </ScrollView>

      <BottomSheet
        visible={sheetOpen}
        onDismiss={() => setSheetOpen(false)}
        dismissAccessibilityLabel="Cerrar comprobante"
        footer={<Button label="Cerrar" onPress={() => setSheetOpen(false)} />}
      >
        <Text style={styles.sheetTitle}>¡Marca registrada!</Text>
        <Text style={styles.sheetBody}>
          Este registro forma parte del libro de asistencia electrónico (Resolución 38 de la
          Dirección del Trabajo).
        </Text>
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surfacePage,
  },
  content: {
    padding: spacing[5],
    gap: spacing[3],
    paddingBottom: spacing[8],
  },
  title: {
    ...typography.h1,
    color: colors.textHeading,
  },
  section: {
    ...typography.eyebrow,
    color: colors.textMuted,
    marginTop: spacing[3],
  },
  stack: {
    gap: spacing[2],
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  cardHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
    marginBottom: spacing[3],
  },
  cardTitle: {
    ...typography.label,
    color: colors.textHeading,
  },
  sheetTitle: {
    ...typography.h2,
    color: colors.textHeading,
    textAlign: 'center',
  },
  sheetBody: {
    ...typography.bodyLg,
    color: colors.textMuted,
    marginTop: spacing[3],
  },
});
