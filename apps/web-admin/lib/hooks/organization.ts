'use client';

import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import fetcher, { buildIncludeQuery, FetcherError } from '../api/fetcher';
import { Prisma } from '@modulariot/db';
import { deleteOrganization, updateOrganization } from '../api/org';

type OrganizationWithProjects = Prisma.OrganizationGetPayload<{
    include: { projects: true },
}>;

export const useOrganization = (orgId: string, options?: { include?: Prisma.OrganizationInclude }) => {
    let includeString = '';
    if (options?.include) {
      includeString = buildIncludeQuery(options.include);
    }
    const { data, error, isLoading } = useSWR<OrganizationWithProjects, FetcherError>(`/api/organizations/${orgId}${includeString}`, fetcher);
    return { data, error, isLoading };
};

export const useUpdateOrganization = (orgId: string) => {
    return useSWRMutation(`/api/organizations/${orgId}`, updateOrganization);
};

export const useDeleteOrganization = (orgId: string) => {
    return useSWRMutation(`/api/organizations/${orgId}`, deleteOrganization);
};