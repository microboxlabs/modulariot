import nextra from 'nextra'
import path from 'path'

// Set up Nextra with its configuration
const withNextra = nextra({
  // ... Add Nextra-specific options here
  search: {
    codeblocks: false,
  },
})
 
// Export the final Next.js config with Nextra included
/** @type {import('next').NextConfig} */
const nextConfig = withNextra({
  i18n: {
    locales: ['en', 'es'],
    defaultLocale: 'en'
  },
  turbopack: {
    resolveAlias: {
      'next-mdx-import-source-file': './mdx-components.js'
    }
  },
  output: 'standalone',
  // Required for npm workspace monorepo: trace dependencies from monorepo root
  outputFileTracingRoot: path.join(import.meta.dirname, '../../'),
})

export default nextConfig