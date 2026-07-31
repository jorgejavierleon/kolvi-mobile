import { renderHook } from '@testing-library/react-native';
import { useFonts } from 'expo-font';

import { fontAssets, useKolviFonts } from './fonts';

jest.mock('expo-font', () => ({ useFonts: jest.fn() }));

const useFontsMock = jest.mocked(useFonts);

describe('useKolviFonts', () => {
  it('asks for every bundled family', async () => {
    useFontsMock.mockReturnValue([true, null]);

    await renderHook(() => useKolviFonts());

    expect(useFontsMock).toHaveBeenCalledWith(fontAssets);
  });

  it('holds the splash screen while the fonts load', async () => {
    useFontsMock.mockReturnValue([false, null]);

    const { result } = await renderHook(() => useKolviFonts());

    expect(result.current).toBe(false);
  });

  it('reports ready once they have loaded', async () => {
    useFontsMock.mockReturnValue([true, null]);

    const { result } = await renderHook(() => useKolviFonts());

    expect(result.current).toBe(true);
  });

  it('lets the app through on a font failure rather than trapping it behind the splash', async () => {
    useFontsMock.mockReturnValue([false, new Error('could not decode Sora_700Bold.ttf')]);

    const { result } = await renderHook(() => useKolviFonts());

    expect(result.current).toBe(true);
  });
});
