import nextra from 'nextra'

 
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
})

export default nextConfig