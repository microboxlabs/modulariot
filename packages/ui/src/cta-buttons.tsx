'use client';

import { useState } from 'react';
import { CloudUpload, Settings, FileText, Users } from 'lucide-react';
import { ConnectStreamModal } from './connect-stream-modal';

export interface CTAButtonsConfig {
  showStreamIngest?: boolean;
  showProjectSettings?: boolean;
  showTeamManagement?: boolean;
  showReports?: boolean;
  onStreamIngestClick?: () => void;
  onProjectSettingsClick?: () => void;
  onTeamManagementClick?: () => void;
  onReportsClick?: () => void;
  // For Stream Ingest modal
  orgId: string;
  projectId: string;
  onFetchCredentials?: (projectId: string) => Promise<{ apiKey: string }>;
  // TODO: Add more buttons as needed
}

interface CTAButtonsProps {
  config?: CTAButtonsConfig;
}

export function CTAButtons({ config = {} }: CTAButtonsProps) {
  const [isStreamModalOpen, setIsStreamModalOpen] = useState(false);
  
  const {
    showStreamIngest = false,
    showProjectSettings = false,
    showTeamManagement = false,
    showReports = false,
    onStreamIngestClick,
    onProjectSettingsClick,
    onTeamManagementClick,
    onReportsClick,
    orgId,
    projectId,
    onFetchCredentials,
  } = config;

  const handleStreamIngestClick = () => {
    if (onStreamIngestClick) {
      onStreamIngestClick();
    } else if (orgId && projectId) {
      setIsStreamModalOpen(true);
    }
  };

  // Don't render if no buttons should be shown
  const hasVisibleButtons = showStreamIngest || showProjectSettings || showTeamManagement || showReports;
  if (!hasVisibleButtons) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      {/* Stream Ingest - Visible on project pages */}
      {showStreamIngest && (
        <button 
          onClick={handleStreamIngestClick}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-md transition-colors"
        >
          <CloudUpload className="h-4 w-4" />
          Stream Ingest
        </button>
      )}
      
      {/* Project Settings - Visible on project pages */}
      {showProjectSettings && (
        <button 
          onClick={onProjectSettingsClick}
          className="inline-flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-sm font-medium rounded-md transition-colors"
        >
          <Settings className="h-4 w-4" />
          Settings
        </button>
      )}
      
      {/* Team Management - Visible on org pages */}
      {showTeamManagement && (
        <button 
          onClick={onTeamManagementClick}
          className="inline-flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-sm font-medium rounded-md transition-colors"
        >
          <Users className="h-4 w-4" />
          Invite Team
        </button>
      )}
      
      {/* Reports - Context dependent */}
      {showReports && (
        <button 
          onClick={onReportsClick}
          className="inline-flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-sm font-medium rounded-md transition-colors"
        >
          <FileText className="h-4 w-4" />
          Export
        </button>
      )}
      
      {/* TODO: SaaS-only features - conditionally hide in OSS build */}
      {/* 
      <button className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-sm font-medium rounded-md transition-colors">
        SaaS Feature
      </button>
      */}
      
      {/* Stream Ingest Modal */}
      {showStreamIngest && orgId && projectId && (
        <ConnectStreamModal
          isOpen={isStreamModalOpen}
          onClose={() => setIsStreamModalOpen(false)}
          orgId={orgId}
          projectId={projectId}
          onFetchCredentials={onFetchCredentials}
        />
      )}
    </div>
  );
}