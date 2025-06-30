'use client';

import { signOut } from "next-auth/react";
import { useOrganizations } from "@/lib/hooks/organization";
import { Header } from "@modulariot/ui/header";
import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";

export function AdminHeader() {
    
    const pathname = usePathname();
    const showBreadcrumbs = pathname.includes('/org/')
   
    const { data: organizations } = useOrganizations({
        projects: true,
    });

    const showProjectBreadcrumb = pathname.includes('/project/');

    const { data: session } = useSession();

    const router = useRouter();
    
    return (
        <Header 
            user={session?.user}
            showBreadcrumbs={showBreadcrumbs} 
            showProjectBreadcrumb={showProjectBreadcrumb} 
            organizations={organizations}
            onSignOut={async () => {
                await signOut({
                    redirect: true,
                    redirectTo: '/login',
                });
            }}
        />
    );
}