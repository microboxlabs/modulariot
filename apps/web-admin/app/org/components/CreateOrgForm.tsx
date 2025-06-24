'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, TextInput, Select, Spinner } from 'flowbite-react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { CTAButton } from '@modulariot/ui/cta-button';
import { createOrganization } from '@/lib/api/org';

const organizationTypes = [
  { value: 'personal', label: 'Personal' },
  { value: 'startup', label: 'Startup' },
  { value: 'enterprise', label: 'Enterprise' },
  { value: 'non-profit', label: 'Non-profit' },
] as const;

const organizationPlans = [
  { value: 'free', label: 'Free – $0/mo' },
  { value: 'pro', label: 'Pro – $49/mo' },
] as const;

const createOrgSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters').max(60, 'Name must be less than 60 characters'),
  type: z.enum(['personal', 'startup', 'enterprise', 'non-profit']),
  plan: z.enum(['free', 'pro']),
});

type CreateOrgFormData = z.infer<typeof createOrgSchema>;

export function CreateOrgForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateOrgFormData>({
    resolver: zodResolver(createOrgSchema),
    defaultValues: {
      name: '',
      type: 'personal',
      plan: 'free',
    },
  });

  const onSubmit = async (data: CreateOrgFormData) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await createOrganization(data);
      router.push('/org');
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to create organization');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    router.push('/org');
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Organization Name */}
      <div className="space-y-2">
        <label htmlFor="name" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Organization name
        </label>
        <TextInput
          id="name"
          type="text"
          placeholder="Organization name"
          aria-label="Organization name"
          {...register('name')}
          color={errors.name ? 'failure' : 'gray'}
          disabled={isSubmitting}
        />
        {errors.name && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {errors.name.message}
          </p>
        )}
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Choose a name that represents your organization
        </p>
      </div>

      {/* Organization Type */}
      <div className="space-y-2">
        <label htmlFor="type" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Organization type
        </label>
        <Select
          id="type"
          aria-label="Organization type"
          {...register('type')}
          color={errors.type ? 'failure' : 'gray'}
          disabled={isSubmitting}
        >
          {organizationTypes.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </Select>
        {errors.type && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {errors.type.message}
          </p>
        )}
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Select the type that best describes your organization
        </p>
      </div>

      {/* Plan Selection */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <label htmlFor="plan" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Plan
          </label>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Pricing
            <ExternalLink size={12} />
          </Link>
        </div>
        <Select
          id="plan"
          aria-label="Plan selection"
          {...register('plan')}
          color={errors.plan ? 'failure' : 'gray'}
          disabled={isSubmitting}
        >
          {organizationPlans.map((plan) => (
            <option key={plan.value} value={plan.value}>
              {plan.label}
            </option>
          ))}
        </Select>
        {errors.plan && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {errors.plan.message}
          </p>
        )}
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Choose a plan that fits your needs
        </p>
      </div>

      {/* Submit Error */}
      {submitError && (
        <div className="p-4 text-sm text-red-700 bg-red-100 border border-red-300 rounded-md dark:bg-red-900 dark:text-red-300 dark:border-red-700" role="alert">
          {submitError}
        </div>
      )}

      {/* Form Actions */}
      <div className="flex gap-3 pt-4">
        <Button
          type="button"
          color="gray"
          outline
          onClick={handleCancel}
          disabled={isSubmitting}
          className="flex-1"
        >
          Cancel
        </Button>
        <CTAButton
          type="submit"
          variant="primary"
          size="md"
          disabled={isSubmitting}
          className="flex-1 w-full"
        >
          {isSubmitting && <Spinner size="sm" className="mr-2" />}
          Create organization
        </CTAButton>
      </div>

      {/* Helper Note */}
      <p className="text-sm text-slate-500 dark:text-slate-400 text-center pt-2">
        You can rename your organization later.
      </p>
    </form>
  );
}