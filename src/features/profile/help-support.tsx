import { nativeApplicationVersion, nativeBuildVersion } from 'expo-application';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { appVersionLabel, es } from '@/i18n';
import { colors, spacing, typography } from '@/theme';
import { Card } from '@/ui/card';
import { ListRow } from '@/ui/list-row';

const strings = es.profile.helpSupport;

/**
 * Ayuda y soporte's body (KMO-27): the Chilean Spanish help content Res. 38
 * Art. 5 requires, plus a support contact and the build identifier support
 * needs to place a report.
 *
 * A card per topic rather than one long card — each is its own unit an
 * employee can find by its heading, and none of them truncates or fixes its
 * height, since `Screen`'s scroll area is what makes this legible at the
 * largest OS font-scale setting rather than merely assumed to be.
 */
export function HelpSupport() {
  return (
    <View style={styles.container}>
      {Object.entries(strings.sections).map(([key, section]) => (
        <HelpSection key={key} title={section.title} body={section.body} />
      ))}

      <Card padded={false} testID="help-support-contact-card">
        <ListRow
          title={strings.contact.action}
          subtitle={strings.contact.email}
          divider={false}
          testID="help-support-contact"
          accessibilityLabel={`${strings.contact.action}: ${strings.contact.email}`}
          onPress={() => {
            void Linking.openURL(`mailto:${strings.contact.email}`);
          }}
        />
      </Card>

      <Text style={styles.version}>
        {appVersionLabel(nativeApplicationVersion, nativeBuildVersion)}
      </Text>
    </View>
  );
}

type HelpSectionProps = {
  title: string;
  body: readonly string[];
};

function HelpSection({ title, body }: HelpSectionProps) {
  return (
    <Card style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {body.map((paragraph) => (
        <Text key={paragraph} style={styles.sectionBody}>
          {paragraph}
        </Text>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[4],
  },
  section: {
    gap: spacing[2],
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.textHeading,
  },
  sectionBody: {
    ...typography.bodyLg,
    color: colors.textBody,
  },
  version: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
