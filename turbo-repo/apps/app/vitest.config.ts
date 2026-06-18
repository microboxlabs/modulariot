/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    server: {
      deps: {
        // next-auth imports "next/server" extensionless; inline it so the
        // resolve alias below applies (externalized deps bypass aliases).
        inline: [/next-auth/, /@auth\/core/],
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/**',
        'src/test/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/*.setup.*',
        '**/coverage/**',
        '**/.next/**',
        '**/dist/**',
        '**/build/**',
        '**/*.stories.{js,jsx,ts,tsx}',
        '**/_*.{js,jsx,ts,tsx}',
      ],
    },
    include: [
      'src/**/*.{test,spec}.{js,jsx,ts,tsx}',
    ],
    exclude: [
      'node_modules/**',
      'dist/**',
      '.next/**',
      'coverage/**',
      '**/*.config.*',
      '**/*.setup.*',
      '**/__tests__/**',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@assets': path.resolve(__dirname, './public'),
      // next-auth imports "next/server" without an extension, which Vite can't
      // resolve against Next's exports map outside the Next.js build.
      'next/server': 'next/server.js',
      'server-only': path.resolve(__dirname, './src/test/server-only-stub.ts'),
    },
  },
}) 