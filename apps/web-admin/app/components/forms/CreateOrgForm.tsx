'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button, TextInput, Alert, Modal, ModalHeader, ModalBody, HelperText } from 'flowbite-react'
import { Building, Check } from 'lucide-react'
import { CTAButton } from '@modulariot/ui/cta-button'

const CreateOrgSchema = z.object({
  name: z.string().min(2, 'Organization name must be at least 2 characters').max(50, 'Organization name must be less than 50 characters'),
})

type CreateOrgFormData = z.infer<typeof CreateOrgSchema>

interface CreateOrgFormProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (org: { id: string; name: string; slug: string }) => void
}

export default function CreateOrgForm({ isOpen, onClose, onSuccess }: CreateOrgFormProps) {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateOrgFormData>({
    resolver: zodResolver(CreateOrgSchema),
  })

  const onSubmit = async (data: CreateOrgFormData) => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
        }),
      })

      if (response.ok) {
        const org = await response.json()
        onSuccess(org)
        reset()
        onClose()
      } else {
        const errorData = await response.json()
        setError(errorData.message || 'Failed to create organization')
      }
    } catch (err) {
      console.error(err);
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
          <Building className="w-5 h-5 text-blue-500" />
          Create New Organization
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
            <label htmlFor="name" className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
              Organization Name
            </label>
            <TextInput
              id="name"
              type="text"
              placeholder="Acme Corporation"
              {...register('name')}
              color={errors.name ? 'failure' : 'gray'}
              icon={Building}
            />
            <HelperText>
            <span className="text-sm text-gray-500 dark:text-gray-400">
                {errors.name?.message}
            </span>
            </HelperText>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Choose a name that represents your organization or team.
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              onClick={handleClose}
              color="gray"
              disabled={loading}
              className="flex-1"
            >
              Cancel
            </Button>
            <CTAButton
              type="submit"
              variant="primary"
              size="md"
              disabled={isSubmitting || loading}
              className="flex-1 w-full"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Create Organization
                </>
              )}
            </CTAButton>
          </div>
        </form>
      </ModalBody>
    </Modal>
  )
} 