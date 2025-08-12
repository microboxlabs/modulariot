"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { useRouter } from "next/navigation";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

interface AlfrescoAuthError {
  error: {
    errorKey: string;
    statusCode: number;
    briefSummary: string;
    stackTrace: string;
    descriptionURL: string;
    logId: string;
  };
}

/**
 * Error boundary component that specifically handles Alfresco authentication errors
 * and redirects users to login when their ticket expires
 */
export class AlfrescoErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, _errorInfo: ErrorInfo) {
    // Check if this is an Alfresco authentication error
    if (this.isAlfrescoAuthError(error)) {
      // Redirect to login
      if (typeof window !== "undefined") {
        const currentPath = window.location.pathname;
        if (!currentPath.includes("/sign-in")) {
          window.location.href = "/app/sign-in";
        }
      }
    }
  }

  private isAlfrescoAuthError(error: Error): boolean {
    try {
      // Check if the error message contains Alfresco authentication error
      if (
        error.message &&
        error.message.includes("Authentication failed for Web Script")
      ) {
        return true;
      }

      // Try to parse the error message as JSON to check for structured errors
      if (error.message) {
        const parsed = JSON.parse(error.message) as AlfrescoAuthError;
        return (
          parsed?.error?.errorKey === "framework.exception.ApiDefault" &&
          parsed?.error?.statusCode === 401 &&
          parsed?.error?.briefSummary?.includes(
            "Authentication failed for Web Script",
          )
        );
      }

      return false;
    } catch {
      return false;
    }
  }

  render() {
    if (this.state.hasError) {
      // If it's an Alfresco auth error, don't show the fallback
      // The redirect should happen automatically
      if (this.state.error && this.isAlfrescoAuthError(this.state.error)) {
        return null;
      }

      // For other errors, show the fallback or a default error message
      return (
        this.props.fallback || (
          <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                Something went wrong
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                An unexpected error occurred. Please try refreshing the page.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Refresh Page
              </button>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

/**
 * Hook-based wrapper for the error boundary
 */
export function useAlfrescoErrorBoundary() {
  const router = useRouter();

  const handleError = React.useCallback(
    (error: Error) => {
      if (isAlfrescoAuthError(error)) {
        router.push("/app/sign-in");
      }
    },
    [router],
  );

  return { handleError };
}

/**
 * Helper function to check if an error is an Alfresco authentication error
 */
function isAlfrescoAuthError(error: Error): boolean {
  try {
    // Check if the error message contains Alfresco authentication error
    if (
      error.message &&
      error.message.includes("Authentication failed for Web Script")
    ) {
      return true;
    }

    // Try to parse the error message as JSON to check for structured errors
    if (error.message) {
      const parsed = JSON.parse(error.message) as AlfrescoAuthError;
      return (
        parsed?.error?.errorKey === "framework.exception.ApiDefault" &&
        parsed?.error?.statusCode === 401 &&
        parsed?.error?.briefSummary?.includes(
          "Authentication failed for Web Script",
        )
      );
    }

    return false;
  } catch {
    return false;
  }
}
