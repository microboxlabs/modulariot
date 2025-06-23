import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import MarketingPanel from '@/app/components/MarketingPanel'
import SignUpPageClient from './SignUpPageClient'

export default async function SignUpPage() {
  const session = await auth()
  
  if (session?.user) {
    redirect('/org')
  }

  return (
    <div className="h-screen grid grid-cols-1 sm:grid-cols-2">
      <MarketingPanel />
      <SignUpPageClient />
    </div>
  )
} 