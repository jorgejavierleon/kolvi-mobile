import { StyleSheet, Text, View } from 'react-native';

import { isNaiveDate } from '@/api/datetime';
import { es, formatLongDateWithYear, formatRut, isRut } from '@/i18n';
import { colors, radius, spacing, tones, typography } from '@/theme';
import { Card } from '@/ui/card';
import { TriangleAlertIcon } from '@/ui/icons';

import type { SessionUser } from '../auth/session-user';

export type ProfileDetailProps = {
  user: SessionUser;
};

type Field = {
  label: string;
  value: string;
};

/**
 * Mis datos (KMO-51): the read-only record docs/design-decisions.md §9 replaced
 * KMO-26's editable subset with. Every field the server returned, and nothing
 * this screen can change — no `TextField`, no save action, no link anywhere.
 *
 * A field the server did not return is left out of the list entirely rather
 * than drawn blank or with a placeholder (#2) — a row with nothing after the
 * label reads as broken, not as "unset".
 */
export function ProfileDetail({ user }: ProfileDetailProps) {
  const fields: Field[] = [];
  const push = (label: string, value: string | null) => {
    if (value !== null) {
      fields.push({ label, value });
    }
  };

  const strings = es.profile.misDatos.fields;

  push(strings.name, user.name);
  // A RUT that does not match the shape formatRut expects is treated the same
  // as one the server never sent — isRut is what that function's own docs
  // recommend for exactly this: deciding whether to render rather than
  // catching a thrown RutFormatError.
  push(strings.rut, user.rut !== null && isRut(user.rut) ? formatRut(user.rut) : null);
  push(strings.corporateEmail, user.email);
  push(strings.personalEmail, user.personalEmail);
  push(strings.phone, user.phone);
  push(strings.position, user.position);
  push(strings.premise, user.premise);
  push(strings.supervisor, user.supervisor);
  // Same reasoning as the RUT above: a value that does not match the naive
  // `YYYY-MM-DD` shape the wire promises is treated as absent rather than
  // thrown on.
  push(
    strings.contractStart,
    user.contractStartDate !== null && isNaiveDate(user.contractStartDate)
      ? formatLongDateWithYear(user.contractStartDate)
      : null,
  );

  return (
    <>
      <Card padded={false} testID="mis-datos-fields">
        {fields.map((field, index) => (
          <View
            key={field.label}
            accessible
            accessibilityLabel={`${field.label}: ${field.value}`}
            style={[styles.row, index === fields.length - 1 ? null : styles.divided]}
          >
            <Text style={styles.label}>{field.label}</Text>
            <Text style={styles.value}>{field.value}</Text>
          </View>
        ))}
      </Card>

      {/* #3 — an employee with no personal email loses both the Art. 12 receipt
          and document verification codes silently, so this is not a footnote:
          it explains what is missing and why, and stops there. Adding one
          happens on the web app, not from here (#4). */}
      {user.personalEmail !== null ? null : (
        <View style={styles.prompt} testID="mis-datos-no-personal-email">
          <TriangleAlertIcon color={tones.warning.foreground} size={iconSize} />
          <Text style={styles.promptText}>{es.profile.misDatos.noPersonalEmail}</Text>
        </View>
      )}
    </>
  );
}

const iconSize = 18;

const styles = StyleSheet.create({
  row: {
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    gap: spacing[1] / 2,
  },
  divided: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  label: {
    ...typography.eyebrow,
    color: colors.textMuted,
  },
  value: {
    ...typography.body,
    color: colors.textHeading,
  },
  prompt: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2] + 2,
    backgroundColor: tones.warning.background,
    borderRadius: radius.lg,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3] + 2,
    marginTop: spacing[4],
  },
  promptText: {
    ...typography.label,
    color: tones.warning.foreground,
    flex: 1,
  },
});
