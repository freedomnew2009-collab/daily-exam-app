import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // โหลดข้อมูลใน useEffect แล้ว setState เป็น pattern ปกติของแอปนี้
      'react-hooks/set-state-in-effect': 'off',
      // store.jsx ตั้งใจ export ทั้ง Provider และ hook (useStore) คู่กัน
      'react-refresh/only-export-components': 'off',
    },
  },
])
