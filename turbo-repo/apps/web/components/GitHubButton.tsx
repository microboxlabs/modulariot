'use client';

import { FaGithub } from 'react-icons/fa';

interface GitHubButtonProps {
  href?: string;
  className?: string;
  children?: React.ReactNode;
}

export default function GitHubButton({ 
  href = process.env.NEXT_PUBLIC_GITHUB_REPO || 'https://github.com/microboxlabs/modular-iot',
  className = '',
  children = 'Star us on GitHub'
}: GitHubButtonProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center px-4 py-2 text-sm font-medium text-blue-500 bg-transparent border border-blue-500 rounded-lg hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900 dark:hover:text-blue-400 transition-colors duration-200 ${className}`}
      data-analytics="github-star-btn"
    >
      <FaGithub className="mr-2 h-4 w-4" />
      {children}
    </a>
  );
} 