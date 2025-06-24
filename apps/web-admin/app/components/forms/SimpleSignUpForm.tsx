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

interface SimpleSignUpFormProps {
  onSocialLogin?: (provider: 'google' | 'github' | 'apple') => void
  socialLoading?: boolean
}

export default function SimpleSignUpForm({ onSocialLogin, socialLoading }: SimpleSignUpFormProps) {
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

      // TODO: Implement signup API call
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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {error && (
        <Alert color="failure">
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
          aria-label="Full name"
        />
        {errors.name && (
          <HelperText color="failure">
            {errors.name.message}
          </HelperText>
        )}
      </div>

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

      <div>
        <TextInput
          id="confirmPassword"
          type="password"
          placeholder="Confirm your password"
          {...register('confirmPassword')}
          color={errors.confirmPassword ? 'failure' : 'gray'}
          icon={Lock}
          aria-label="Confirm password"
        />
        {errors.confirmPassword && (
          <HelperText color="failure">
            {errors.confirmPassword.message}
          </HelperText>
        )}
      </div>

      <Button
        type="submit"
        className="w-full focus:ring-4 focus:ring-blue-300/50 dark:focus:ring-blue-600/30"
        disabled={isSubmitting || loading || socialLoading}
        color="blue"
      >
        {loading ? 'Creating account...' : 'Sign Up'}
      </Button>
    </form>
  )
}