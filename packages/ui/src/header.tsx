'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { DarkThemeToggle } from 'flowbite-react';
import { Logo } from './Logo';
import { OrgSwitcher } from './org-switcher';
import { ProjectSwitcher } from './project-switcher';
import { CTAButtons } from './cta-buttons';
import { Organization } from './org-switcher';
import { Project } from './project-switcher';
import { useEffect, useState } from 'react';

interface User {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  avatar?: string;
}

interface HeaderProps {
  user?: User;
  onSignOut?: () => void | Promise<void>;
  logoSize?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

export function Header({ 
  user,
  onSignOut,
  logoSize = "xs",
  className = ""
}: HeaderProps) {
  const params = useParams();
  const pathname = usePathname();
  
  const orgId = params?.orgId as string;
  const projectId = params?.projectId as string;

  const [organizations, setOrganizations] = useState<Organization[]>([]);

  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [orgLoading, setOrgLoading] = useState(true);
  const [orgError, setOrgError] = useState<string | null>(null);

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectLoading, setProjectLoading] = useState(true);
  const [projectError, setProjectError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrgs = async () => {
      try {
        setOrgLoading(true);
        setOrgError(null);
        const res = await fetch('/api/organizations');
        if (!res.ok) throw new Error('Failed to fetch organizations');
        const data = await res.json() as Organization[];
        setOrganizations(data);
        setCurrentOrg(data.find(org => org.id === orgId) ?? data[0] ?? null);
      } catch (err) {
        setOrgError(err instanceof Error ? err.message : 'Failed to fetch organizations');
        setOrganizations([]);
      } finally {
        setOrgLoading(false);
      }
    };

    const fetchProjects = async () => {
      const res = await fetch(`/api/projects?orgId=${orgId}`);
      if (!res.ok) throw new Error('Failed to fetch projects');
      const data = await res.json() as Project[];
      setProjects(data);
    };

    fetchOrgs();
    fetchProjects();
  }, [orgId]);
  
  


  // Determine current org and project
  const currentProject = projects.find(project => project.id === projectId);
  
  // Show breadcrumbs only on org/project pages
  const showBreadcrumbs = pathname.includes('/org/');
  const showProjectBreadcrumb = pathname.includes('/project/') && currentProject;
  
  // Determine which CTA buttons to show based on current path
  const getCtaButtonsConfig = () => {
    // Project context - show stream ingest and project settings
    if (pathname.includes('/project/')) {
      return {
        showStreamIngest: true,
        showProjectSettings: false, // TODO: Show on specific project subpages
        showReports: pathname.includes('/reports'), // Show on reports page
        orgId,
        projectId,
      };
    }
    
    // Organization context - show team management
    if (pathname.includes('/org/')) {
      return {
        showTeamManagement: pathname.includes('/teams'), // Show on teams page
        showReports: pathname.includes('/reports'), // Show on reports page
        orgId,
        projectId,
      };
    }
    
    // Default - no buttons
    return {
        orgId,
        projectId,
    };
  };

  const handleAvatarClick = async () => {
    if (onSignOut) {
      try {
        await onSignOut();
      } catch (error) {
        console.error('Sign out error:', error);
      }
    }
  };

  return (
    <header className={`sticky top-0 z-50 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 ${className}`}>
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-16 gap-4">
          {/* Logo */}
          <Link href="/" className="flex-shrink-0">
            <Logo size={logoSize} />
          </Link>
          
          {/* Breadcrumbs */}
          {showBreadcrumbs && (
            <>
              <div className="flex items-center gap-2">
                <OrgSwitcher currentOrg={currentOrg} organizations={organizations} />
                
                {showProjectBreadcrumb && (
                  <>
                    <span className="text-slate-400 dark:text-slate-500">/</span>
                    <ProjectSwitcher currentProject={currentProject} projects={projects} />
                  </>
                )}
              </div>
            </>
          )}
          
          {/* Spacer */}
          <div className="flex-grow" />
          
          {/* CTA Buttons */}
          <CTAButtons config={getCtaButtonsConfig()} />
          
          {/* Right side - User area */}
          <div className="flex items-center gap-4">
            <DarkThemeToggle />
            
            {/* TODO: Add feedback/bell icons here */}
            
            {/* User Menu */}
            {user && (
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    {user.name || user.email}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {user.email}
                  </p>
                </div>
                
                <div 
                  className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center cursor-pointer hover:bg-primary-600 transition-colors"
                  onClick={handleAvatarClick}
                  title="Click to sign out"
                >
                  <span className="text-white text-sm font-medium">
                    {(user.name || user.email)?.charAt(0).toUpperCase()}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
} 