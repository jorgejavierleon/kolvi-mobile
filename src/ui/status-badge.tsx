import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, spacing, tones, typography, type Tone } from '@/theme';

export type StatusBadgeProps = {
  /**
   * The text is the status. It is never decorative and never optional: the
   * pill's colour repeats what the label already says, so an employee who
   * cannot distinguish the tints still reads `Atrasado` rather than guessing
   * at an amber pill. See "status is never encoded by colour alone" in the
   * README conventions.
   */
  label: string;
  /**
   * One of the four semantic tones, which map 1:1 onto the server's `badge()`
   * tones — so a workday that is `warning` on the web is the same amber here.
   */
  tone: Tone;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * The pill used for workday status, leave-request status and document state.
 *
 * Not interactive, so it is exempt from the 44px hit target; where a badge sits
 * inside a tappable row the row carries the target.
 */
export function StatusBadge({ label, tone, style, testID }: StatusBadgeProps) {
  const { background, foreground } = tones[tone];

  return (
    <View style={[styles.pill, { backgroundColor: background }, style]} testID={testID}>
      <Text style={[typography.eyebrow, { color: foreground }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    // Shrinks before the row's primary text does, and wraps rather than
    // overflowing once the OS font scale grows.
    flexShrink: 1,
    borderRadius: radius.pill,
    paddingVertical: spacing[1],
    paddingHorizontal: spacing[3],
  },
});
