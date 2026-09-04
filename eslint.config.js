import eslint from '@eslint/js'
import stylistic from '@stylistic/eslint-plugin'
import { defineConfig } from 'eslint/config'
import { jsdoc } from 'eslint-plugin-jsdoc'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import eslintPluginUnicorn from 'eslint-plugin-unicorn'
import globals from 'globals'

export default defineConfig([
  {
    ignores: ['dist/**', 'vendor/**', 'test/fixtures/**'],
  },
  eslint.configs.recommended,
  eslintPluginUnicorn.configs['recommended'],
  stylistic.configs.recommended,
  jsdoc({
    config: 'flat/recommended',
  }),
  {
    plugins: {
      'simple-import-sort': simpleImportSort,
    },
    rules: {
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
    },
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2026,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      '@stylistic/object-curly-spacing': [
        'error',
        'always',
        {
          emptyObjects: 'never', // It is align with unicorn/empty-brace-spaces rule
        },
      ],
      'comma-dangle': ['error', 'always-multiline'],
      'unicorn/no-null': 'off',
      'unicorn/name-replacements': [
        'error',
        {
          allowList: {
            Dir: true,
            dir: true,
            env: true,
            Env: true,
            fn: true,
            Fn: true,
          },
        },
      ],
    },
  },
])
