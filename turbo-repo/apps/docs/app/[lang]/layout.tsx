import { Footer, Layout, Navbar } from 'nextra-theme-docs'
import { Head } from 'nextra/components'
import { getPageMap } from 'nextra/page-map'
import 'nextra-theme-docs/style.css'
import '../globals.css'

export const metadata = {
  title: {
    default: 'ModularIoT Documentation',
    template: '%s | ModularIoT Docs'
  },
  description: 'Real-time operational intelligence for your fleet. Documentation for ModularIoT platform.',
}

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

export default async function RootLayout({ children, params }: { children: React.ReactNode, params: Promise<{ lang: string }> }): Promise<React.ReactElement> {
  const { lang } = await params
  const pageMap = (await getPageMap(`/${lang}`));

  return (
    <html
      lang="en"
      dir="ltr"
      suppressHydrationWarning
    >
      <Head>
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <body>
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
      </body>
    </html>
  )
}