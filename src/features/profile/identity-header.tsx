import { StyleSheet, Text, View } from 'react-native';

import { profileIdentity } from '@/i18n';
import { colors, radius, spacing, typography } from '@/theme';

import type { SessionUser } from '../auth/session-user';

export type IdentityHeaderProps = {
  user: SessionUser;
};

/**
 * The avatar, name and `{position} · {premise}` line at the top of Mi perfil
 * (KMO-25 #2).
 *
 * Centred and static — unlike the small header avatar it echoes, this one is
 * not a control: the profile screen is already the destination it would open.
 */
export function IdentityHeader({ user }: IdentityHeaderProps) {
  const identity = profileIdentity(user.position, user.premise);

  return (
    <View style={styles.container}>
      <View style={styles.avatar} testID="profile-avatar">
        <Text style={styles.initials}>{initialsFrom(user.name)}</Text>
      </View>
      <Text style={styles.name}>{user.name}</Text>
      {/* Omitted rather than left blank: an employee with neither assigned yet
          (ams KOL-61 lands the fields, not a value for every employee) should
          not read a lone " · " where the sentence used to be. */}
      {identity === null ? null : <Text style={styles.identity}>{identity}</Text>}
    </View>
  );
}

/**
 * `Camila Rojas` → `CR`. The first letter of the first word and the first
 * letter of the last, which is what the design's own `{{ userInitials }}`
 * does for every name in the mockup (`Camila Rojas` → `CR`).
 *
 * A single-word name draws just that one letter rather than repeating it —
 * doubling a letter neither the name nor the design asked for would be
 * inventing data, the same reason KMO-4 left the header avatar a bare glyph
 * rather than guess at initials with no session to read a name from.
 */
export function initialsFrom(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return '';
  }

  const first = words[0]?.[0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : '';

  return (first + last).toUpperCase();
}

/** The design's 72dp circle, larger than the header's 40dp avatar. */
const avatarSize = 72;

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  avatar: {
    width: avatarSize,
    height: avatarSize,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[3],
  },
  initials: {
    // The design draws 24px here; h2 is the closest preset, the same rounding
    // screen-header.tsx already does for the smaller header avatar's 14px.
    ...typography.h2,
    color: colors.white,
  },
  name: {
    // The design draws 18px; h3 is the closest preset carrying the same
    // Sora 700 weight (h2 at 22 overshoots further than h3 at 16 undershoots).
    ...typography.h3,
    color: colors.textHeading,
  },
  identity: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing[1] / 2,
  },
});
