'use client';

import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import fetcher, { deleteFetcher, FetcherError } from '../api/fetcher';
import { Prisma } from '@modulariot/db';
import { updateOrganization } from '../api/organization';
import { endpointOrg } from '../api/endpoints';



export const useOrganization = (orgId: string, options?: Prisma.OrganizationInclude) => {
    const { data, error, isLoading } = useSWR<Prisma.OrganizationGetPayload<{ include: Prisma.OrganizationInclude }>, FetcherError>(endpointOrg(orgId, options), fetcher);
    return { data, error, isLoading };
};

export const useUpdateOrganization = (orgId: string) => {
    return useSWRMutation(endpointOrg(orgId), updateOrganization);
};

export const useDeleteOrganization = (orgId: string) => {
    return useSWRMutation(endpointOrg(orgId), deleteFetcher);
};