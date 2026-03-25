'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import AuthForm from '@/app/components/AuthForm'
import SimpleLoginForm from '@/app/components/forms/SimpleLoginForm'

export default function LoginPageClient() {
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
      title="Sign in to your account"
      subtitle="Don't have an account?"
      switchText=""
      switchLink="/signup"
      switchLinkText="Sign up"
      onSocialLogin={handleSocialLogin}
      socialLoading={socialLoading}
    >
      <SimpleLoginForm 
        onSocialLogin={handleSocialLogin}
        socialLoading={socialLoading}
      />
    </AuthForm>
  )
}