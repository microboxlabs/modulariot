import { Footer, Layout, Navbar } from 'nextra-theme-docs'
import { getPageMap } from 'nextra/page-map'

const navbar = (
  <Navbar
    logo={
      <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>
        ModularIoT
      </span>
    }
    projectLink="https://github.com/microboxlabs/modulariot"
  />
)

const footer = (
  <Footer>
    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: '1rem' }}>
      <span>MIT {new Date().getFullYear()} © MicroboxLabs</span>
      <span>ModularIoT - Real-time Operational Intelligence</span>
    </div>
  </Footer>
)

/**
 * The Nextra shell for one part of the site. `route` picks the page map the
 * sidebar is built from: the platform docs use the locale root, each product
 * uses its own folder, so product pages never show the platform sections.
 */
export async function DocsLayout({ route, children }: { route: string, children: React.ReactNode }): Promise<React.ReactElement> {
  const pageMap = await getPageMap(route)
  return (
    <Layout
      navbar={navbar}
      pageMap={pageMap}
      docsRepositoryBase="https://github.com/microboxlabs/modulariot/tree/main/apps/docs"
      footer={footer}
      editLink="Edit this page on GitHub"
      feedback={{ content: null }}
      sidebar={{ defaultMenuCollapseLevel: 1 }}
    >
      {children}
    </Layout>
  )
}
