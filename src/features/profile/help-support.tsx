import { nativeApplicationVersion, nativeBuildVersion } from 'expo-application';
import { useState } from 'react';
import {
  LayoutAnimation,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';

import { appVersionLabel, es } from '@/i18n';
import { colors, hitTargetMin, spacing, typography } from '@/theme';
import { Card } from '@/ui/card';
import { ChevronDownIcon } from '@/ui/icons';
import { ListRow } from '@/ui/list-row';

// Android only animates layout changes opt-in; iOS has always animated them.
if (UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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
 *
 * Each card is a disclosure (KMO-52): closed by default so the screen opens
 * as a list of headings rather than every Res. 38 paragraph at once, and more
 * than one can be open together since nothing here needs the sections to be
 * mutually exclusive.
 */
export function HelpSupport() {
  // Closed by default (KMO-52) — every section open at once was the wall of
  // text this replaces. Keyed by section key rather than a single open index:
  // #3 lets more than one stay open together.
  const [openSections, setOpenSections] = useState<ReadonlySet<string>>(() => new Set());

  const toggleSection = (key: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenSections((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <View style={styles.container}>
      {Object.entries(strings.sections).map(([key, section]) => (
        <HelpSection
          key={key}
          title={section.title}
          body={section.body}
          open={openSections.has(key)}
          onToggle={() => {
            toggleSection(key);
          }}
          testID={`help-support-section-${key}`}
        />
      ))}

      <Card padded={false} testID="help-support-contact-card">
        <ListRow
          title={strings.contact.action}
          subtitle={strings.contact.email}
          divider={false}
          style={styles.contactRow}
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
  open: boolean;
  onToggle: () => void;
  testID: string;
};

function HelpSection({ title, body, open, onToggle, testID }: HelpSectionProps) {
  return (
    <Card padded={false} testID={testID}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded: open }}
        onPress={onToggle}
        style={styles.sectionHeader}
        testID={`${testID}-toggle`}
      >
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={open ? styles.chevronOpen : undefined}>
          <ChevronDownIcon color={colors.textMuted} size={20} />
        </View>
      </Pressable>

      {/* Unmounted rather than hidden, so a collapsed section's text is not
          left in the accessibility tree for a screen reader to still find. */}
      {open ? (
        <View style={styles.sectionBody}>
          {body.map((paragraph) => (
            <Text key={paragraph} style={styles.sectionBodyText}>
              {paragraph}
            </Text>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[4],
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
    minHeight: hitTargetMin,
    padding: spacing[4],
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.textHeading,
    flexShrink: 1,
  },
  chevronOpen: {
    transform: [{ rotate: '180deg' }],
  },
  sectionBody: {
    gap: spacing[2],
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[4],
  },
  sectionBodyText: {
    ...typography.bodyLg,
    color: colors.textBody,
  },
  contactRow: {
    paddingHorizontal: spacing[4],
  },
  version: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
