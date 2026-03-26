'use client'

import { SessionProvider } from 'next-auth/react'
import { ReactNode } from 'react'
import { ModularThemeProvider } from '@modulariot/ui/modular-theme'

interface ProvidersProps {
  children: ReactNode
}

export default function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider>
      <ModularThemeProvider>
        {children}
      </ModularThemeProvider>
    </SessionProvider>
  )
}