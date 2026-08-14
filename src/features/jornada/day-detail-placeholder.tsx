import { StyleSheet, Text } from 'react-native';

import { es } from '@/i18n';
import { colors, spacing, typography } from '@/theme';
import { BottomSheet } from '@/ui/bottom-sheet';

export type DayDetailPlaceholderProps = {
  visible: boolean;
  onDismiss: () => void;
  testID?: string;
};

/**
 * What tapping a Historial row opens today (KMO-33 #7): the design wires the
 * row to a day detail, and KMO-34 is the ticket that builds it. Until then
 * this says so plainly rather than the row doing nothing or crashing — the
 * same honest-placeholder standard `SectionScaffold` sets for a whole
 * unbuilt tab, sized down to one sheet.
 */
export function DayDetailPlaceholder({ visible, onDismiss, testID }: DayDetailPlaceholderProps) {
  // Nothing at all rather than a hidden sheet, matching `LocationRationale`:
  // this is a `Modal`, and leaving it mounted keeps a second surface around
  // for the whole session.
  if (!visible) {
    return null;
  }

  return (
    <BottomSheet
      dismissAccessibilityLabel={es.jornada.historial.dayDetail.close}
      onDismiss={onDismiss}
      testID={testID}
      visible
    >
      <Text style={styles.title}>{es.jornada.historial.dayDetail.title}</Text>
      <Text style={styles.body}>{es.jornada.historial.dayDetail.body}</Text>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.h3,
    color: colors.textHeading,
  },
  body: {
    ...typography.bodyLg,
    color: colors.textBody,
    marginTop: spacing[3],
  },
});
