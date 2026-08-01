// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier/flat');

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    ignores: ['dist/*', 'backlog/*', 'docs/*', '.expo/*', 'coverage/*'],
  },
  {
    // The design tokens are the single source of truth (KMO-2). `src/theme` is where
    // the hex values and the type scale live; everywhere else imports them from
    // `@/theme` so a colour or a size cannot be re-derived per screen.
    files: ['src/**/*.{ts,tsx}', 'app.config.ts'],
    ignores: ['src/theme/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/]',
          message: 'Raw hex colours belong in src/theme — use `colors` or `tones` from @/theme.',
        },
        {
          selector: 'Literal[value=/^(?:rgb|rgba|hsl|hsla)\\(/]',
          message: 'Raw colour values belong in src/theme — use `colors` or `tones` from @/theme.',
        },
        {
          selector:
            'Property[key.name=/^(?:fontSize|lineHeight|fontWeight|fontFamily)$/] > Literal',
          message:
            'Raw type scale values belong in src/theme — spread a preset from `typography` in @/theme.',
        },
      ],
    },
  },
  {
    // Datetimes on the wire are naive Santiago wall-clock strings (KMO-5). A
    // conversion here does not fail loudly — it silently shifts a legally binding
    // attendance timestamp by an hour, which is exactly the adulteration Res. 38
    // Art. 8 is about. So the client is not allowed to hold a timezone-aware value
    // at all: `src/api` works in strings and integers, and `src/i18n` (KMO-6) is
    // where display formatting lives.
    files: ['src/api/**/*.ts'],
    ignores: ['src/api/**/*.test.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
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
      ],
    },
  },
]);
