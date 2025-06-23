'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button, TextInput, Alert, HelperText } from 'flowbite-react'
import { Mail, Lock } from 'lucide-react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

const LoginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

type LoginFormData = z.infer<typeof LoginSchema>

interface SimpleLoginFormProps {
  onSocialLogin?: (provider: 'google' | 'github' | 'apple') => void
  socialLoading?: boolean
}

export default function SimpleLoginForm({ onSocialLogin, socialLoading }: SimpleLoginFormProps) {
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
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {error && (
        <Alert color="failure">
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
          aria-label="Email address"
        />
        {errors.email && (
          <HelperText color="failure">
            {errors.email.message}
          </HelperText>
        )}
      </div>

      <div>
        <TextInput
          id="password"
          type="password"
          placeholder="Enter your password"
          {...register('password')}
          color={errors.password ? 'failure' : 'gray'}
          icon={Lock}
          aria-label="Password"
        />
        {errors.password && (
          <HelperText color="failure">
            {errors.password.message}
          </HelperText>
        )}
      </div>

      <Button
        type="submit"
        className="w-full focus:ring-4 focus:ring-teal-300/50 dark:focus:ring-teal-600/30"
        disabled={isSubmitting || loading || socialLoading}
        style={{ backgroundColor: '#0FB8C9' }}
      >
        {loading ? 'Signing in...' : 'Sign In'}
      </Button>
    </form>
  )
}