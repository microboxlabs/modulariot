import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import MarketingPanel from '@/app/components/MarketingPanel'
import LoginPageClient from './LoginPageClient'

export default async function LoginPage() {
  const session = await auth()
  
  if (session?.user) {
    redirect('/org')
  }

  return (
    <div className="h-screen grid grid-cols-1 sm:grid-cols-2">
      <MarketingPanel />
      <LoginPageClient />
    </div>
  )
} 