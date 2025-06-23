'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button, TextInput, Alert, HelperText } from 'flowbite-react'
import { Mail, Lock, User } from 'lucide-react'
import { useRouter } from 'next/navigation'

const SignUpSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})

type SignUpFormData = z.infer<typeof SignUpSchema>

export default function SignUpForm() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpFormData>({
    resolver: zodResolver(SignUpSchema),
  })

  const onSubmit = async (data: SignUpFormData) => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          password: data.password,
        }),
      })

      if (response.ok) {
        router.push('/login?message=Account created successfully')
      } else {
        const errorData = await response.json()
        setError(errorData.message || 'Failed to create account')
      }
    } catch (err) {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {error && (
          <Alert color="failure" className="mb-4">
            {error}
          </Alert>
        )}

        <div>
          <TextInput
            id="name"
            type="text"
            placeholder="Enter your full name"
            {...register('name')}
            color={errors.name ? 'failure' : 'gray'}
            icon={User}
          />
          <HelperText>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {errors.name?.message}
            </span>
          </HelperText>
        </div>

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

        <div>
          <TextInput
            id="confirmPassword"
            type="password"
            placeholder="Confirm your password"
            {...register('confirmPassword')}
            color={errors.confirmPassword ? 'failure' : 'gray'}
            icon={Lock}
          />
          <HelperText>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {errors.confirmPassword?.message}
            </span>
          </HelperText>
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={isSubmitting || loading}
          color="blue"
        >
          {loading ? 'Creating account...' : 'Create account'}
        </Button>

        <p className="text-sm text-center text-gray-600 dark:text-gray-400">
          By creating an account, you agree to our{' '}
          <a href="/terms" className="text-blue-500 hover:underline">
            Terms of Service
          </a>{' '}
          and{' '}
          <a href="/privacy" className="text-blue-500 hover:underline">
            Privacy Policy
          </a>
        </p>
      </form>
    </div>
  )
} 