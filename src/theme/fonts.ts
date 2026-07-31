import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_500Medium } from '@expo-google-fonts/plus-jakarta-sans/500Medium';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { Sora_700Bold } from '@expo-google-fonts/sora/700Bold';
import { useFonts } from 'expo-font';

import { fontFamilies, type FontFamily } from './typography';

/**
 * The four `.ttf` files the presets reference, keyed by the family name they are
 * registered under. They are bundled with the app, not fetched from Google: the
 * design system's `@import` of the Google Fonts CDN is a web convenience the app
 * cannot rely on, since employees punch in places with no signal at all.
 */
export const fontAssets: Record<FontFamily, number> = {
  [fontFamilies.display]: Sora_700Bold,
  [fontFamilies.uiRegular]: PlusJakartaSans_400Regular,
  [fontFamilies.uiMedium]: PlusJakartaSans_500Medium,
  [fontFamilies.uiSemiBold]: PlusJakartaSans_600SemiBold,
};

/**
 * Loads the bundled families. The root layout holds the splash screen up until this
 * returns `true`, so the first frame the employee sees is already in Sora and Plus
 * Jakarta Sans rather than flashing the system font.
 *
 * A load failure resolves to `true` as well. Falling back to the system font is bad;
 * a splash screen that never lifts because a font file did not decode would leave the
 * employee unable to punch, which is worse.
 */
export function useKolviFonts(): boolean {
  const [loaded, error] = useFonts(fontAssets);

  return loaded || error !== null;
}
