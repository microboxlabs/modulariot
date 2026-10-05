import { Head } from 'nextra/components'
import 'nextra-theme-docs/style.css'
import '../globals.css'

export const metadata = {
  title: {
    default: 'ModularIoT Documentation',
    template: '%s | ModularIoT Docs'
  },
  description: 'Real-time operational intelligence for your fleet. Documentation for ModularIoT platform.',
}

export default async function RootLayout({ children, params }: { children: React.ReactNode, params: Promise<{ lang: string }> }): Promise<React.ReactElement> {
  const { lang } = await params

  return (
    <html
      lang={lang}
      dir="ltr"
      suppressHydrationWarning
    >
      <Head>
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <body>
        {children}
      </body>
    </html>
  )
}
