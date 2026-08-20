import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

export default defineConfig({
  plugins: [
    {
      name: 'vitest-tsx-transform',
      enforce: 'pre',
      transform(code, id) {
        if (!id.endsWith('.tsx')) return null
        return {
          code: ts.transpileModule(code, {
            compilerOptions: {
              jsx: ts.JsxEmit.ReactJSX,
              module: ts.ModuleKind.ESNext,
              target: ts.ScriptTarget.ES2020,
            },
          }).outputText,
          map: null,
        }
      },
    },
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
  },
})
