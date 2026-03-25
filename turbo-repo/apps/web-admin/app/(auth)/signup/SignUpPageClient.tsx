'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import AuthForm from '@/app/components/AuthForm'
import SimpleSignUpForm from '@/app/components/forms/SimpleSignUpForm'

export default function SignUpPageClient() {
  const [socialLoading, setSocialLoading] = useState(false)

  const handleSocialLogin = async (provider: 'google' | 'github' | 'apple') => {
    try {
      setSocialLoading(true)
      await signIn(provider, { callbackUrl: '/org' })
    } catch (err) {
      console.error('OAuth sign in failed:', err)
      setSocialLoading(false)
    }
  }

  return (
    <AuthForm
      title="Create your account"
      subtitle="Already have an account?"
      switchText=""
      switchLink="/login"
      switchLinkText="Sign in"
      onSocialLogin={handleSocialLogin}
      socialLoading={socialLoading}
    >
      <SimpleSignUpForm 
        onSocialLogin={handleSocialLogin}
        socialLoading={socialLoading}
      />
    </AuthForm>
  )
}