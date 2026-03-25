'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button, TextInput, Alert, Tabs, TabItem, HelperText } from 'flowbite-react'
import { Mail, Lock, Github } from 'lucide-react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

const LoginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

type LoginFormData = z.infer<typeof LoginSchema>

export default function LoginForm() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(LoginSchema),
  })

  const onSubmit = async (data: LoginFormData) => {
    try {
      setLoading(true)
      setError(null)

      const result = await signIn('credentials', {
        email: data.email,
        password: data.password,
        redirect: false,
      })

      if (result?.error) {
        setError('Invalid email or password')
      } else {
        router.push('/org')
      }
    } catch (err) {
      console.error(err);
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleOAuthSignIn = async (provider: 'google' | 'github') => {
    try {
      setLoading(true)
      await signIn(provider, { callbackUrl: '/org' })
    } catch (err) {
      console.error(err);
      setError('OAuth sign in failed. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <Tabs aria-label="Login options" variant="default">
        <TabItem active title="Email" icon={Mail}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {error && (
              <Alert color="failure" className="mb-4">
                {error}
              </Alert>
            )}

            <div>
              <TextInput
                id="email"
                type="email"
                placeholder="Enter your email"
                {...register('email')}
                color={errors.email ? 'failure' : 'gray'}
                icon={Mail}
              />
              <HelperText>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {errors.email?.message}
                </span>
              </HelperText>
            </div>

            <div>
              <TextInput
                id="password"
                type="password"
                placeholder="Enter your password"
                {...register('password')}
                color={errors.password ? 'failure' : 'gray'}
                icon={Lock}
              />
              <HelperText>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {errors.password?.message}
                </span>
              </HelperText>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting || loading}
              color="blue"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>
        </TabItem>

        <TabItem title="Social" icon={Github}>
          <div className="space-y-4">
            <Button
              type="button"
              onClick={() => handleOAuthSignIn('google')}
              className="w-full"
              color="light"
              disabled={loading}
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
              onClick={() => handleOAuthSignIn('github')}
              className="w-full"
              color="dark"
              disabled={loading}
            >
              <Github className="w-5 h-5 mr-2" />
              Continue with GitHub
            </Button>
          </div>
        </TabItem>
      </Tabs>

      {/* TEST: Playwright e2e stub */}
      {/* 
      test('should login with valid credentials', async ({ page }) => {
        await page.goto('/login')
        await page.fill('[data-testid="email"]', 'demo@miot.dev')
        await page.fill('[data-testid="password"]', 'demo123')
        await page.click('[data-testid="login-submit"]')
        await expect(page).toHaveURL('/org')
      })
      */}
    </div>
  )
} 