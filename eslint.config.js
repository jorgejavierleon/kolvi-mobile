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
]);
