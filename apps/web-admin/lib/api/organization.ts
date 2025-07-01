import { Prisma, Organization } from '@modulariot/db';
import fetcher from './fetcher';


export interface CreateOrganizationRequest {
  name: string;
  type: 'personal' | 'startup' | 'enterprise' | 'non-profit';
  plan: 'free' | 'pro';
}


export async function createOrganization(data: CreateOrganizationRequest): Promise<Organization> {
  // TODO: Replace with actual API endpoint when backend is ready
  const response = await fetch('/api/organizations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    if (response.status === 400) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Invalid organization data');
    }
    if (response.status === 409) {
      throw new Error('An organization with this name already exists');
    }
    if (response.status >= 500) {
      throw new Error('Server error. Please try again later.');
    }
    throw new Error('Failed to create organization');
  }

  if (response.status !== 201) {
    throw new Error('Unexpected response from server');
  }

  return response.json();
}


type UpdateOrganizationArgs = { 
  arg: Prisma.OrganizationUpdateInput;
};

export async function updateOrganization(url: string, { arg: organization }: UpdateOrganizationArgs): Promise<Organization> {
  const response = await fetcher<Organization>(url, {
    method: 'PATCH',
    body: JSON.stringify(organization),
  });

  return response;
}

// TODO: Add additional organization management functions as needed
// export async function getOrganizations(): Promise<Organization[]> { ... }
// export async function updateOrganization(id: string, data: Partial<CreateOrganizationRequest>): Promise<Organization> { ... }
// export async function deleteOrganization(id: string): Promise<void> { ... }