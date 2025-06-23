import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import Link from 'next/link'
import { Logo } from '@/app/components/Logo'
import { Footer } from '@/app/components/Footer'
import { DarkModeToggle } from '@/app/components/DarkModeToggle'
import { Building, Plus, Users, Zap } from 'lucide-react'

export default async function Dashboard() {
  const session = await auth()

  if (!session?.user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Logo />
            
            <div className="flex items-center gap-4">
              <DarkModeToggle />
              
              {/* User Menu */}
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {session.user.name || session.user.email}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {session.user.email}
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

      {/* Main Content */}
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Welcome Section */}
          <div className="mb-8">
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white tracking-tight">
              Welcome to ModularIoT
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Manage your IoT devices, monitor symptoms, and analyze data from your dashboard.
            </p>
          </div>

          {/* Quick Actions Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {/* Create Organization Card */}
            <Link href="/org" className="group">
              <div className="card hover:shadow-lg transition-shadow cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center group-hover:bg-blue-200 dark:group-hover:bg-blue-800 transition-colors">
                    <Building className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Organizations
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Create or manage your organizations
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex items-center text-blue-600 dark:text-blue-400 text-sm font-medium">
                  Get started
                  <Plus className="w-4 h-4 ml-1" />
                </div>
              </div>
            </Link>

            {/* Quick Stats */}
            <div className="card">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                  <Zap className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Getting Started
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Follow our setup guide
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <Link href="/docs" className="text-green-600 dark:text-green-400 text-sm font-medium hover:underline">
                  View documentation
                </Link>
              </div>
            </div>

            {/* Community */}
            <div className="card">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Community
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Connect with other users
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <a 
                  href="https://github.com/modulariot/community" 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-600 dark:text-purple-400 text-sm font-medium hover:underline"
                >
                  Join community
                </a>
              </div>
            </div>
          </div>

          {/* Platform Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Platform Features
              </h2>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-gray-700 dark:text-gray-300">Device management and monitoring</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-gray-700 dark:text-gray-300">Real-time symptom detection</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-gray-700 dark:text-gray-300">Team collaboration and RBAC</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-gray-700 dark:text-gray-300">Webhook notifications</span>
                </div>
              </div>
            </div>

            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Next Steps
              </h2>
              <div className="space-y-4">
                <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <h4 className="font-medium text-gray-900 dark:text-white">1. Create Organization</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Set up your first organization to start managing devices
                  </p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <h4 className="font-medium text-gray-900 dark:text-white">2. Invite Team Members</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Collaborate with your team by sending invitations
                  </p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <h4 className="font-medium text-gray-900 dark:text-white">3. Register Devices</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Start adding your IoT devices to the platform
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
} 