import { DocsLayout } from '../docs-layout'

export default async function ProductsLayout({ children, params }: { children: React.ReactNode, params: Promise<{ lang: string }> }): Promise<React.ReactElement> {
  const { lang } = await params
  return <DocsLayout route={`/${lang}/products`}>{children}</DocsLayout>
}
