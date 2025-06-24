'use client'

import { ReactNode } from 'react'
import Link from 'next/link'
import { Button, TextInput, Alert } from 'flowbite-react'
import { Github, Apple } from 'lucide-react'

interface AuthFormProps {
  title: string
  subtitle: string
  switchText: string
  switchLink: string
  switchLinkText: string
  children: ReactNode
  showSocialLogin?: boolean
  onSocialLogin?: (provider: 'google' | 'github' | 'apple') => void
  socialLoading?: boolean
}

export default function AuthForm({
  title,
  subtitle,
  switchText,
  switchLink,
  switchLinkText,
  children,
  showSocialLogin = true,
  onSocialLogin,
  socialLoading = false
}: AuthFormProps) {
  return (
    <div className="flex items-center justify-center min-h-screen p-6">
      <div className="w-full sm:max-w-[420px] mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
            {title}
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {subtitle}{' '}
            <Link 
              href={switchLink} 
              className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
            >
              {switchLinkText}
            </Link>
          </p>
        </div>

        {showSocialLogin && (
          <>
            <div className="space-y-3">
              <Button
                type="button"
                onClick={() => onSocialLogin?.('google')}
                className="w-full focus:ring-4 focus:ring-blue-300/50 dark:focus:ring-blue-600/30"
                color="light"
                disabled={socialLoading}
                aria-label="Continue with Google"
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </Button>

              <Button
                type="button"
                onClick={() => onSocialLogin?.('github')}
                className="w-full focus:ring-4 focus:ring-blue-300/50 dark:focus:ring-blue-600/30"
                color="dark"
                disabled={socialLoading}
                aria-label="Continue with GitHub"
              >
                <Github className="w-5 h-5 mr-2" />
                Continue with GitHub
              </Button>

              <Button
                type="button"
                onClick={() => onSocialLogin?.('apple')}
                className="w-full focus:ring-4 focus:ring-blue-300/50 dark:focus:ring-blue-600/30"
                color="light"
                disabled={socialLoading}
                aria-label="Continue with Apple"
              >
                <Apple className="w-5 h-5 mr-2" />
                Continue with Apple
              </Button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300 dark:border-gray-600" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white dark:bg-slate-800 text-orange-600 dark:text-orange-400 font-medium">
                  or
                </span>
              </div>
            </div>
          </>
        )}

        <div className="space-y-4">
          {children}
        </div>

        <div className="text-center">
          <Link 
            href="/forgot-password" 
            className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Forgot your password?
          </Link>
        </div>

        <div className="pt-4 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            By continuing, you agree to our{' '}
            <Link href="/terms" className="text-blue-600 hover:underline dark:text-blue-400">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="text-blue-600 hover:underline dark:text-blue-400">
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}