import { StyleSheet, Text, View } from 'react-native';

import { es, sectionEnd } from '@/i18n';
import { colors, spacing, typography } from '@/theme';

import { Card } from './card';

export type SectionScaffoldProps = {
  /** The section this stands in for, e.g. `Jornada`. */
  section: string;
};

/**
 * Temporary body for a tab whose content has not been built yet. KMO-15, 32,
 * 39 and 42 replace it one tab at a time; KMO-30 checks none of it survived.
 *
 * It is deliberately taller than the screen. KMO-4 #5 is about per-tab scroll
 * position surviving a switch away and back, and there is nothing to scroll —
 * and so nothing to verify — until a tab has content that overflows. The end
 * marker names its own section so the flow can tell which tab it is looking at.
 */
export function SectionScaffold({ section }: SectionScaffoldProps) {
  return (
    <View style={styles.body}>
      <Card>
        <Text style={styles.note}>{es.scaffold.underConstruction}</Text>
      </Card>
      <View style={styles.filler} />
      <Text style={styles.marker}>{sectionEnd(section)}</Text>
    </View>
  );
}

/** Comfortably past the 892dp frame the design is drawn in. */
const fillerHeight = 900;

const styles = StyleSheet.create({
  body: {
    gap: spacing[4],
  },
  note: {
    ...typography.body,
    color: colors.textBody,
  },
  filler: {
    height: fillerHeight,
  },
  marker: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
