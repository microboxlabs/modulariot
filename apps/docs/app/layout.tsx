import { Footer, Layout, Navbar } from 'nextra-theme-docs'
import { Head } from 'nextra/components'
import { getPageMap } from 'nextra/page-map'
// Required for theme styles, previously was imported under the hood
import 'nextra-theme-docs/style.css'

export const metadata = {
  title: 'Nextra Docs',
  description: 'Documentation site built with Nextra',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      // Not required, but good for SEO
      lang="en"
      // Required to be set
      dir="ltr"
      // Suggested by `next-themes` package https://github.com/pacocoursey/next-themes#with-app
      suppressHydrationWarning
    >
      <Head />
      <body>
        <Layout
          navbar={<Navbar logo={<b>Nextra</b>} />}
          pageMap={await getPageMap()}
          docsRepositoryBase="https://github.com/shuding/nextra/tree/main/docs"
          editLink="Edit this page on GitHub"
          sidebar={{ defaultMenuCollapseLevel: 1 }}
          footer={<Footer>MIT 2024 © Nextra.</Footer>}
        >
          {children}
        </Layout>
      </body>
    </html>
  )
}
