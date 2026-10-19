import { DocsLayout } from '../docs-layout'

export default async function PlatformLayout({ children, params }: { children: React.ReactNode, params: Promise<{ lang: string }> }): Promise<React.ReactElement> {
  const { lang } = await params
  return <DocsLayout route={`/${lang}`}>{children}</DocsLayout>
}
