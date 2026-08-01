import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, hitTargetMin, radius, spacing, typography } from '@/theme';

import { UserIcon } from './icons';

export type ScreenHeaderProps = {
  /** The screen title — `Mi jornada`, `Permisos`, `Documentos`. */
  title: string;
  /** Opens the profile surface. */
  onPressAvatar: () => void;
  /** What a screen reader calls the avatar button, e.g. `Abrir mi perfil`. */
  avatarLabel: string;
  /**
   * The employee's initials, which the design fills the avatar with. Optional
   * only because there is no session to read a name from until KMO-8; the
   * button falls back to a person glyph rather than to invented initials.
   */
  avatarInitials?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * The title-and-avatar row at the top of every tab.
 *
 * It scrolls with the content rather than being pinned by the navigator, which
 * is how the design draws it — the home screen in particular gives its whole
 * first screenful to the clock, and a fixed bar would take a slice of that back.
 */
export function ScreenHeader({
  title,
  onPressAvatar,
  avatarLabel,
  avatarInitials,
  style,
  testID,
}: ScreenHeaderProps) {
  return (
    <View style={[styles.header, style]} testID={testID}>
      <Text style={styles.title}>{title}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={avatarLabel}
        onPress={onPressAvatar}
        style={styles.avatar}
        testID="profile-button"
      >
        {avatarInitials === undefined ? (
          <UserIcon color={colors.white} size={avatarGlyphSize} />
        ) : (
          <Text style={styles.initials}>{avatarInitials}</Text>
        )}
      </Pressable>
    </View>
  );
}

/** Sized against the design's 40dp avatar, not the 44dp hit target it grew to. */
const avatarGlyphSize = spacing[5];

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
    marginBottom: spacing[4],
  },
  title: {
    ...typography.h2,
    color: colors.textHeading,
    // Yields to the avatar, which cannot shrink, and wraps instead of pushing
    // the button off the row once the OS font scale grows.
    flexShrink: 1,
  },
  avatar: {
    // The design draws 40dp. The avatar is the only way to the profile, so the
    // hit-target minimum wins here as it does everywhere else.
    width: hitTargetMin,
    height: hitTargetMin,
    flexShrink: 0,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    ...typography.h3,
    color: colors.white,
  },
});
