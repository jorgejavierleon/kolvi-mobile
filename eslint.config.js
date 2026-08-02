// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier/flat');

// The design tokens are the single source of truth (KMO-2). `src/theme` is where the
// hex values and the type scale live; everywhere else imports them from `@/theme` so
// a colour or a size cannot be re-derived per screen.
const themeSelectors = [
  {
    selector: 'Literal[value=/^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/]',
    message: 'Raw hex colours belong in src/theme — use `colors` or `tones` from @/theme.',
  },
  {
    selector: 'Literal[value=/^(?:rgb|rgba|hsl|hsla)\\(/]',
    message: 'Raw colour values belong in src/theme — use `colors` or `tones` from @/theme.',
  },
  {
    selector: 'Property[key.name=/^(?:fontSize|lineHeight|fontWeight|fontFamily)$/] > Literal',
    message:
      'Raw type scale values belong in src/theme — spread a preset from `typography` in @/theme.',
  },
];

// The interface is Spanish (Chile) because Res. 38 Art. 5 requires it, and that is
// only auditable if there is one place to audit (KMO-6). A string typed into a
// component is not a small shortcut — it is a line of user-facing copy that no
// longer appears in `src/i18n`, so nobody reviewing the catalogue can see it.
//
// These catch the three ways copy actually gets hardcoded: as element text, as an
// accessibility or title prop, and as a `label` in an options array. Domain
// vocabulary from the server never trips them, because it arrives as a variable.
const i18nSelectors = [
  {
    selector: 'JSXText[value=/\\S/]',
    message:
      'User-facing text belongs in src/i18n — render an entry from `es` or a formatter from @/i18n.',
  },
  {
    selector:
      'JSXAttribute[name.name=/^(?:accessibilityLabel|accessibilityHint|title|label|placeholder)$/] > Literal[value=/\\S/]',
    message:
      'Text a user reads or a screen reader speaks belongs in src/i18n — pass an entry from `es`.',
  },
  {
    selector: 'Property[key.name=/^(?:label|placeholder)$/] > Literal[value=/\\S/]',
    message:
      'A user-facing label belongs in src/i18n — reference an entry from `es` rather than writing it here.',
  },
];

// Datetimes on the wire are naive Santiago wall-clock strings (KMO-5). A conversion
// here does not fail loudly — it silently shifts a legally binding attendance
// timestamp by an hour, which is exactly the adulteration Res. 38 Art. 8 is about.
// So the client is not allowed to hold a timezone-aware value at all: `src/api`
// works in strings and integers, and `src/i18n` is where display formatting lives.
const naiveDatetimeSelectors = [
  {
    selector: "NewExpression[callee.name='Date'], MemberExpression[object.name='Date']",
    message:
      'src/api handles datetimes as naive wall-clock strings — a `Date` would apply the device timezone. Use the helpers in @/api/datetime.',
  },
  {
    selector: "MemberExpression[object.name='Intl']",
    message:
      'src/api must not localise or convert datetimes. Formatting for display belongs in src/i18n.',
  },
  {
    selector:
      'MemberExpression[property.name=/^(?:toISOString|toUTCString|getTimezoneOffset|toLocaleString|toLocaleDateString|toLocaleTimeString)$/]',
    message:
      'This stamps or strips a timezone offset on a naive Santiago wall-clock value. See the header of src/api/datetime.ts.',
  },
];

// `no-restricted-syntax` takes one array of selectors, and a later config block
// replaces that array rather than adding to it. So a block that wants two sets has
// to spread both — the composition below is what keeps the theme rules applying
// inside src/ui and src/features while the i18n rules apply there too.
module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    ignores: ['dist/*', 'backlog/*', 'docs/*', '.expo/*', 'coverage/*'],
  },
  {
    files: ['src/**/*.{ts,tsx}', 'app.config.ts'],
    ignores: ['src/theme/**'],
    rules: {
      'no-restricted-syntax': ['error', ...themeSelectors],
    },
  },
  {
    // Two exemptions, and both are narrow.
    //
    // Tests, because a test asserting on the copy a screen renders has to write that
    // copy down somewhere, and it is not shipped UI.
    //
    // `gallery.tsx`, because it is a bench rather than a screen: its strings are
    // stand-ins for values the server supplies (`Atrasado` and `Ausente` are workday
    // statuses, and KMO-6 #7 is that those are never routed through the catalogue)
    // and previews of copy other tasks will author. KMO-30 deletes the file. Listing
    // it here rather than disabling the rule inline keeps the theme selectors
    // applying to it through the `src/**` block above.
    files: ['src/app/**/*.{ts,tsx}', 'src/ui/**/*.{ts,tsx}', 'src/features/**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}', 'src/ui/gallery.tsx'],
    rules: {
      'no-restricted-syntax': ['error', ...themeSelectors, ...i18nSelectors],
    },
  },
  {
    files: ['src/api/**/*.ts'],
    ignores: ['src/api/**/*.test.ts'],
    rules: {
      'no-restricted-syntax': ['error', ...naiveDatetimeSelectors],
    },
  },
]);
