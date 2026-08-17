import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { es, unsyncedPunchesWarning } from '@/i18n';
import { colors, radius, spacing, tones, typography } from '@/theme';
import { BottomSheet } from '@/ui/bottom-sheet';
import { Button } from '@/ui/button';
import { ListRow } from '@/ui/list-row';

import { useSession } from './session';

export type SignOutProps = {
  /**
   * Punches this phone is holding that the server has never seen, which signing
   * out destroys (#3).
   *
   * A prop rather than something this module reads for itself: the queue is
   * marcaje's, and a feature never imports another feature. `src/app/` composes,
   * so the route passes the count once KMO-22/23 build the queue to count. Zero
   * until then, which is honest — there is nothing queued today.
   */
  pendingPunches?: number;
};

/**
 * Cerrar sesión, and the confirmation standing in front of it (#2, #3).
 *
 * The confirmation is not politeness. Signing out revokes this phone's token and
 * is what stands between an employee and a device someone else is about to hold
 * — so the tap that does it has to be the second one, and the sheet has to say
 * what the first one costs.
 *
 * With punches queued the body is replaced rather than added to: an employee
 * about to sign out with punches still on the phone should not have to read
 * past the ordinary wording to learn what happens to them. What happens is
 * they stay (docs/design-decisions.md §4.7 D4) — signing out has never
 * touched the queue, only the token, and KMO-49 makes that true of the copy
 * as well as the code.
 *
 * The trigger is a bare `ListRow` rather than its own card: KMO-25 folds this in
 * as the last row of Mi perfil's four-row menu, in the danger tone the design
 * draws it in, with no divider under it since nothing follows it in the card.
 */
export function SignOut({ pendingPunches = 0 }: SignOutProps) {
  const { signOut } = useSession();

  const [confirming, setConfirming] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const inFlight = useRef(false);

  const atRisk = pendingPunches > 0;

  const onConfirm = () => {
    void (async () => {
      if (inFlight.current) {
        return;
      }

      inFlight.current = true;
      setSigningOut(true);

      // No cleanup after it resolves and no error branch: a completed sign-out
      // unmounts this whole subtree with the session it belonged to, and a failed
      // revocation is not a failed sign-out — `signOut` clears the session either
      // way and the login screen says the rest.
      await signOut();
    })();
  };

  const onCancel = () => {
    // Ignored once the sign-out is under way. The backdrop is still there and
    // still pressable, and closing the sheet at that point would leave the
    // employee looking at a profile screen that is about to disappear.
    if (inFlight.current) {
      return;
    }

    setConfirming(false);
  };

  return (
    <>
      <ListRow
        accessibilityLabel={es.auth.signOut.action}
        divider={false}
        onPress={() => setConfirming(true)}
        style={styles.row}
        testID="sign-out-action"
        title={es.auth.signOut.action}
        tone="danger"
      />

      {confirming ? (
        <BottomSheet
          dismissAccessibilityLabel={es.auth.signOut.close}
          // The backdrop and the Android back button mean Cancelar. The
          // destructive answer is only ever the button that names itself.
          onDismiss={onCancel}
          testID="sign-out-confirm"
          visible={confirming}
          footer={
            <View style={styles.footer}>
              <Button
                label={es.auth.signOut.action}
                loading={signingOut}
                onPress={onConfirm}
                testID="sign-out-confirm-action"
                variant="danger"
              />
              <Button
                disabled={signingOut}
                label={es.actions.cancel}
                onPress={onCancel}
                testID="sign-out-cancel"
                variant="secondary"
              />
            </View>
          }
        >
          <View style={styles.body}>
            <Text style={styles.title}>{es.auth.signOut.title}</Text>

            {atRisk ? (
              <View style={styles.warning} testID="sign-out-unsynced-warning">
                <Text style={styles.warningMessage}>{unsyncedPunchesWarning(pendingPunches)}</Text>
              </View>
            ) : (
              <Text style={styles.explanation}>{es.auth.signOut.body}</Text>
            )}
          </View>
        </BottomSheet>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  // This row sits in Mi perfil's `padded={false}` card, which drops Card's
  // own inset for the full-bleed divider between rows — restoring it here
  // keeps the row's text off the card edge without affecting the divider,
  // which is a border and unaffected by padding.
  row: {
    paddingHorizontal: spacing[4],
  },
  body: {
    gap: spacing[3],
  },
  title: {
    ...typography.h2,
    color: colors.textHeading,
  },
  explanation: {
    ...typography.bodyLg,
    color: colors.textBody,
  },
  warning: {
    borderRadius: radius.md,
    // Warning, not danger (§4.7 D4): the punches are not being lost, only
    // delayed until this employee is signed in again — the same tone the
    // pending-sync banner already uses for "still waiting".
    backgroundColor: tones.warning.background,
    padding: spacing[4],
  },
  warningMessage: {
    ...typography.bodyLg,
    color: tones.warning.foreground,
  },
  footer: {
    gap: spacing[3],
  },
});
