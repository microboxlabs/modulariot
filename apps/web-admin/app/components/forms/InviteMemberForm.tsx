'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button, TextInput, Alert, Modal, Select, ModalHeader, ModalBody, HelperText } from 'flowbite-react'
import { UserPlus, Mail, Shield } from 'lucide-react'

const InviteMemberSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  role: z.enum(['MEMBER', 'ADMIN']),
})

type InviteMemberFormData = z.infer<typeof InviteMemberSchema>

interface InviteMemberFormProps {
  isOpen: boolean
  onClose: () => void
  orgId: string
  onSuccess: (invitation: { id: string; email: string; role: string; token: string }) => void
}

export default function InviteMemberForm({ isOpen, onClose, orgId, onSuccess }: InviteMemberFormProps) {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InviteMemberFormData>({
    resolver: zodResolver(InviteMemberSchema),
    defaultValues: {
      role: 'MEMBER',
    },
  })

  const onSubmit = async (data: InviteMemberFormData) => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: data.email,
          role: data.role,
          orgId,
        }),
      })

      if (response.ok) {
        const invitation = await response.json()
        onSuccess(invitation)
        reset()
        onClose()
      } else {
        const errorData = await response.json()
        setError(errorData.message || 'Failed to send invitation')
      }
    } catch (err) {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    reset()
    setError(null)
    onClose()
  }

  return (
    <Modal show={isOpen} onClose={handleClose} size="md">
      <ModalHeader>
        <div className="flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-blue-500" />
          Invite Team Member
        </div>
      </ModalHeader>
      
      <ModalBody>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {error && (
            <Alert color="failure">
              {error}
            </Alert>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
              Email Address
            </label>
            <TextInput
              id="email"
              type="email"
              placeholder="colleague@company.com"
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
            <label htmlFor="role" className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
              Role
            </label>
            <Select
              id="role"
              {...register('role')}
              color={errors.role ? 'failure' : 'gray'}
              icon={Shield}
            >
              <option value="MEMBER">Member</option>
              <option value="ADMIN">Admin</option>
            </Select>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              <strong>Member:</strong> Can view and manage devices, symptoms.{' '}
              <strong>Admin:</strong> Can also manage organization settings and invite members.
            </p>
            <HelperText>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {errors.role?.message}
              </span>
            </HelperText>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="submit"
              disabled={isSubmitting || loading}
              color="blue"
              className="flex-1"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Sending...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Send Invitation
                </>
              )}
            </Button>
            
            <Button
              type="button"
              onClick={handleClose}
              color="gray"
              disabled={loading}
            >
              Cancel
            </Button>
          </div>
        </form>
      </ModalBody>
    </Modal>
  )
} 