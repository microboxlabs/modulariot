"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

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
 * Global error handler that catches Alfresco authentication errors
 * and redirects users to login when their ticket expires
 */
export function GlobalErrorHandler() {
  const router = useRouter();

  useEffect(() => {
    // Function to check if an error is an Alfresco authentication error
    const isAlfrescoAuthError = (error: any): boolean => {
      try {
        if (typeof error === "string") {
          const parsed = JSON.parse(error) as AlfrescoAuthError;
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
    };

    // Function to handle authentication errors
    const handleAuthError = (error: any) => {
      if (isAlfrescoAuthError(error)) {
        // Only redirect if we're not already on the sign-in page
        const currentPath = window.location.pathname;
        if (!currentPath.includes("/sign-in")) {
          router.push("/app/sign-in");
        }
      }
    };

    // Override the global error handler
    const originalErrorHandler = window.onerror;
    window.onerror = (message, source, lineno, colno, error) => {
      // Check if this is an Alfresco authentication error
      if (
        message &&
        typeof message === "string" &&
        message.includes("Authentication failed for Web Script")
      ) {
        handleAuthError(message);
        return true; // Prevent default error handling
      }

      // Call original handler for other errors
      if (originalErrorHandler) {
        return originalErrorHandler(message, source, lineno, colno, error);
      }
      return false;
    };

    // Override the global unhandled rejection handler
    const originalRejectionHandler = window.onunhandledrejection;
    window.onunhandledrejection = (event) => {
      // Check if this is an Alfresco authentication error
      if (
        event.reason &&
        typeof event.reason === "string" &&
        event.reason.includes("Authentication failed for Web Script")
      ) {
        handleAuthError(event.reason);
        event.preventDefault(); // Prevent default error handling
        return;
      }

      // Call original handler for other rejections
      if (originalRejectionHandler) {
        originalRejectionHandler.call(window, event);
      }
    };

    // Cleanup function
    return () => {
      window.onerror = originalErrorHandler;
      window.onunhandledrejection = originalRejectionHandler;
    };
  }, [router]);

  // This component doesn't render anything
  return null;
}
