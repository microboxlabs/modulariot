import Link from 'next/link'
import { Github, FileText, Shield } from 'lucide-react'
import { Badge } from 'flowbite-react'
import Logo from './Logo'
import { getVersionBadge } from '../../lib/version'

export default function Footer() {
  return (
    <footer className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Logo and Copyright */}
          <div className="space-y-4">
            <Logo size="sm" />
            <p className="text-sm text-gray-600 dark:text-gray-400">
              © ModularIoT 2025. All rights reserved.
            </p>
            <Badge color="gray" size="sm" className="w-fit">
              {getVersionBadge()}
            </Badge>
          </div>

          {/* Links */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Resources
            </h3>
            <div className="space-y-2">
              <Link 
                href="https://github.com/modulariot"
                className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-500 transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Github size={16} />
                GitHub
              </Link>
              <Link 
                href="/docs"
                className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-500 transition-colors"
              >
                <FileText size={16} />
                Documentation
              </Link>
              <Link 
                href="/privacy"
                className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-500 transition-colors"
              >
                <Shield size={16} />
                Privacy Policy
              </Link>
            </div>
          </div>

          {/* Additional Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Platform
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Modular IoT platform for device management, monitoring, and analytics.
            </p>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
          <p className="text-center text-xs text-gray-500 dark:text-gray-400">
            Built with Next.js, TypeScript, and Tailwind CSS
          </p>
        </div>
      </div>
    </footer>
  )
} 