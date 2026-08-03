import { API_VERSION_PREFIX, resolveApiBaseUrl, resolveApiOrigin } from './config';

describe('the API origin', () => {
  const original = process.env.EXPO_PUBLIC_API_URL;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.EXPO_PUBLIC_API_URL;
    } else {
      process.env.EXPO_PUBLIC_API_URL = original;
    }
  });

  it('comes from the build-time environment variable', () => {
    process.env.EXPO_PUBLIC_API_URL = 'https://ams.kolvi.cl';

    expect(resolveApiOrigin()).toBe('https://ams.kolvi.cl');
  });

  it('drops a trailing slash so paths do not join into a double slash', () => {
    process.env.EXPO_PUBLIC_API_URL = 'https://ams.kolvi.cl/';

    expect(resolveApiBaseUrl()).toBe('https://ams.kolvi.cl/api/v1');
  });

  // A forgotten variable should point at a local backend, never at a real one:
  // the failure mode of a wrong default is writing to production attendance data.
  it.each([undefined, '', '   '])('falls back to the emulator host route for %p', (value) => {
    if (value === undefined) {
      delete process.env.EXPO_PUBLIC_API_URL;
    } else {
      process.env.EXPO_PUBLIC_API_URL = value;
    }

    expect(resolveApiOrigin()).toBe('http://10.0.2.2:8000');
  });

  // D7 — the app targets the versioned surface exclusively, and since `ams`
  // KOL-6 there is no other surface for it to reach.
  it('always appends the v1 prefix', () => {
    process.env.EXPO_PUBLIC_API_URL = 'https://ams.kolvi.cl';

    expect(API_VERSION_PREFIX).toBe('/api/v1');
    expect(resolveApiBaseUrl()).toBe(`https://ams.kolvi.cl${API_VERSION_PREFIX}`);
  });
});
