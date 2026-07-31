#!/usr/bin/env bash
# Shared setup for the bin/ helpers. Sourced, not executed.
set -euo pipefail

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"

ADB="$ANDROID_HOME/platform-tools/adb"
EMULATOR="$ANDROID_HOME/emulator/emulator"
AVDMANAGER="$ANDROID_HOME/cmdline-tools/latest/bin/avdmanager"

AVD_NAME="${KOLVI_AVD:-kolvi-pixel}"
PACKAGE="cl.kolvi.empleados"
ARTIFACTS="${KOLVI_ARTIFACTS:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/.artifacts}"

die() { echo "error: $*" >&2; exit 1; }

require_adb() {
  [ -x "$ADB" ] || die "adb not found at $ADB — is the SDK installed?"
}

require_device() {
  require_adb
  "$ADB" get-state >/dev/null 2>&1 || die "no emulator running — start one with: bin/emu start"
}
