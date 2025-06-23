import { redirect } from 'next/navigation'
import { auth } from '../../lib/auth'
import Logo from '../components/Logo'
import Footer from '../components/Footer'
import DarkModeToggle from '../components/DarkModeToggle'

export default async function OrgLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session?.user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Logo />
            <div className="flex items-center gap-4">
              <DarkModeToggle />
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {session.user.name || session.user.email}
                  </p>
                </div>
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">
                    {(session.user.name || session.user.email)?.charAt(0).toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>
      <main className="flex-1 bg-gray-50 dark:bg-gray-900">
        {children}
      </main>
      <Footer />
    </div>
  )
} 