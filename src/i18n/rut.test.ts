import { formatRut, isRut, RutFormatError } from './rut';

describe('the dotted RUT', () => {
  // #5 — the form on the comprobante and in Mis datos. Thousands separated by dots,
  // the verifier digit behind a hyphen.
  it('punctuates the bare form the API sends', () => {
    expect(formatRut('123456789')).toBe('12.345.678-9');
  });

  // #8 — the K. The módulo-11 check yields K whenever the remainder is 10, so about
  // one worker in eleven has one. A digits-only pattern serves the other ten and
  // fails this one, on the receipt that names them.
  it('renders a K verifier digit', () => {
    expect(formatRut('12345678K')).toBe('12.345.678-K');
  });

  it('accepts a lowercase k and writes it uppercase, as the design does', () => {
    expect(formatRut('12345678k')).toBe('12.345.678-K');
    expect(formatRut('12.345.678-k')).toBe('12.345.678-K');
  });

  it('is idempotent, so a formatted RUT can go through again unchanged', () => {
    expect(formatRut(formatRut('123456789'))).toBe('12.345.678-9');
    expect(formatRut(formatRut('12345678K'))).toBe('12.345.678-K');
  });

  it('accepts the hyphenated form without dots', () => {
    expect(formatRut('12345678-9')).toBe('12.345.678-9');
  });

  it('ignores surrounding and interior whitespace', () => {
    expect(formatRut(' 12.345.678 - 9 ')).toBe('12.345.678-9');
  });

  // The leading group is the short one. Grouping left to right would give
  // `765.432.1`, which is the bug this case exists to catch.
  it.each([
    ['76543210', '7.654.321-0'],
    ['5678901', '567.890-1'],
    ['123456', '12.345-6'],
    ['1234', '123-4'],
    ['12', '1-2'],
  ])('groups %s from the right as %s', (input, expected) => {
    expect(formatRut(input)).toBe(expected);
  });

  it('handles the largest body the format allows', () => {
    expect(formatRut('99999999K')).toBe('99.999.999-K');
  });
});

describe('values that are not a RUT', () => {
  // Loud, for the same reason a malformed datetime is: the RUT comes from the
  // server's own immutable snapshot of the worker, so a bad one is an upstream bug,
  // and a formatter that returned the input would print that bug on a legal receipt.
  it.each([
    ['', 'empty'],
    ['abcdefgh9', 'letters in the body'],
    ['12345678X', 'a verifier digit that is not 0-9 or K'],
    ['123456789012', 'too long to be a RUT'],
    ['1', 'a body with no verifier digit'],
  ])('refuses %s (%s)', (value) => {
    expect(() => formatRut(value)).toThrow(RutFormatError);
  });

  it('names the value it refused, so the log says which record is wrong', () => {
    expect(() => formatRut('12345678X')).toThrow(/12345678X/);
  });

  it('survives instanceof through the Hermes class transform', () => {
    try {
      formatRut('nope');
    } catch (error) {
      expect(error).toBeInstanceOf(RutFormatError);
      expect(error).toBeInstanceOf(Error);
    }

    expect.assertions(2);
  });
});

describe('asking before formatting', () => {
  it('answers for a screen that would rather render an empty state than catch', () => {
    expect(isRut('12345678K')).toBe(true);
    expect(isRut('12.345.678-9')).toBe(true);
    expect(isRut('')).toBe(false);
    expect(isRut('12345678X')).toBe(false);
    expect(isRut(undefined)).toBe(false);
    expect(isRut(12345678)).toBe(false);
  });
});
