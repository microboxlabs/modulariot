import nextra from 'nextra'
import path from 'path'

// Set up Nextra with its configuration
const withNextra = nextra({
  // ... Add Nextra-specific options here
  search: {
    codeblocks: false,
  },
})
 
// Dashboard pages moved under /products/dashboards; keep the old addresses working.
const dashboardMoves = {
  en: {
    'operations/dashboard-server': '',
    'operations/dashboard-server/installation': 'getting-started/installation',
    'operations/dashboard-server/configuration': 'reference/configuration',
    'operations/dashboard-server/identity': 'how-to/authenticate-users',
    'operations/dashboard-server/datasources': 'how-to/store-credentials',
    'operations/dashboard-server/queries': 'concepts/queries-and-connections',
    'operations/dashboard-server/migration': 'how-to/migrate-planner-dashboards',
    'operations/dashboard-server/roadmap': 'releases',
    'operations/dashboard-server/api': 'reference/rest-api',
    'reference/sdks/miot-dashboard-ui': 'reference/ui-library',
    'reference/sdks/miot-dashboard-contract': 'reference/contract'
  },
  es: {
    'operations/dashboard-server': '',
    'operations/dashboard-server/instalacion': 'getting-started/installation',
    'operations/dashboard-server/configuracion': 'reference/configuration',
    'operations/dashboard-server/identidad': 'how-to/authenticate-users',
    'operations/dashboard-server/fuentes-de-datos': 'how-to/store-credentials',
    'operations/dashboard-server/queries': 'concepts/queries-and-connections',
    'operations/dashboard-server/migracion': 'how-to/migrate-planner-dashboards',
    'operations/dashboard-server/roadmap': 'releases',
    'operations/dashboard-server/api': 'reference/rest-api',
    'reference/sdks/miot-dashboard-ui': 'reference/ui-library',
    'reference/sdks/miot-dashboard-contract': 'reference/contract'
  }
}

const redirects = Object.entries(dashboardMoves).flatMap(([lang, moves]) =>
  Object.entries(moves).map(([from, to]) => ({
    source: `/${lang}/${from}`,
    destination: `/${lang}/products/dashboards${to ? `/${to}` : ''}`,
    permanent: true,
    locale: false
  }))
)

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
  redirects: async () => redirects,
  // Required for npm workspace monorepo: trace dependencies from monorepo root
  outputFileTracingRoot: path.join(import.meta.dirname, '../../'),
})

export default nextConfig