'use client';

import useSWR from 'swr';
import fetcher, { buildIncludeQuery, FetcherError } from '../api/fetcher';
import { Prisma } from '@modulariot/db';

type ProjectWithOrganization = Prisma.ProjectGetPayload<{
    include: { organization: true },
}>;

export const useProject = (projectId: string, orgId: string, options?: { include?: Prisma.ProjectInclude }) => {
    let includeString = '';
    if (options?.include) {
        includeString = buildIncludeQuery(options.include);
    }
    const { data, error, isLoading } = useSWR<ProjectWithOrganization, FetcherError>(`/api/organizations/${orgId}/projects/${projectId}${includeString}`, fetcher);
    return { data, error, isLoading };
}