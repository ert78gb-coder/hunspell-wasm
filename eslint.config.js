import js from '@eslint/js'
import globals from 'globals'

export default [
  {
    ignores: ['dist/**', 'vendor/**', 'test/fixtures/**'],
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2025,
      sourceType: 'module',
      globals: globals.node,
    },
  },
]
