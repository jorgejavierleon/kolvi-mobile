/**
 * The Chilean RUT, written the way a Chilean reads it.
 *
 * The receipt and the profile both show `12.345.678-9`: thousands separated by
 * dots, the verifier digit after a hyphen. Res. 38 Art. 13 lists the worker's RUT
 * as minimum receipt content, so the punctuation is not decoration — it is how an
 * inspector confirms the receipt names the person it claims to name.
 *
 * The verifier digit is carried, never computed. `ams` stamps `employee_rut` onto
 * the immutable legal snapshot when a mark is created, and recalculating a digit
 * here would mean the app could print a RUT the server never recorded. What this
 * module does is punctuate what arrived.
 */

/**
 * Thrown when a value that should be a RUT is not one.
 *
 * Loud, for the same reason `NaiveDateTimeError` is: a RUT reaches the app from the
 * server's own snapshot, so a malformed one is a bug somewhere upstream, and a
 * formatter that quietly returned the input would put that bug on a legal receipt.
 */
export class RutFormatError extends Error {
  constructor(value: unknown) {
    super(
      `Expected a RUT of up to eight digits and a verifier digit, received ${JSON.stringify(value)}`,
    );
    this.name = 'RutFormatError';
    // Hermes and the Babel class transform both need this for `instanceof` to
    // survive extending a built-in.
    Object.setPrototypeOf(this, RutFormatError.prototype);
  }
}

/**
 * Up to eight body digits and one verifier digit, which is `0`–`9` or `K`.
 *
 * `K` is what the módulo-11 check produces when the remainder is 10, so roughly one
 * RUT in eleven has it. It is the case most often missed — a digits-only pattern
 * accepts ten workers out of eleven and rejects the eleventh — so it is in the
 * pattern here and in the tests.
 */
const RUT_PATTERN = /^(\d{1,8})([\dK])$/;

/**
 * `formatRut('12345678K')` → `12.345.678-K`.
 *
 * Accepts the bare form the API sends and an already-punctuated one, so a value
 * that has been through here once can go through again unchanged, and lowercases
 * `k` up to `K` because that is how the design writes it.
 */
export function formatRut(value: string): string {
  const match = RUT_PATTERN.exec(normalise(value));
  const body = match?.[1];
  const verifier = match?.[2];

  if (body === undefined || verifier === undefined) {
    throw new RutFormatError(value);
  }

  return `${groupThousands(body)}-${verifier}`;
}

/**
 * Whether `formatRut` would accept this value — for a screen that has to decide
 * between rendering a RUT and rendering an empty state, rather than catching.
 */
export function isRut(value: unknown): value is string {
  return typeof value === 'string' && RUT_PATTERN.test(normalise(value));
}

function normalise(value: string): string {
  return value.replace(/[.\-\s]/g, '').toUpperCase();
}

function groupThousands(digits: string): string {
  // Right to left, because the leading group is the short one: `7654321` groups as
  // `7.654.321`, not `765.432.1`.
  return digits.replace(/\B(?=(\d{3})+$)/g, '.');
}
