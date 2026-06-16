"use client";

import {
  Component,
  cloneElement,
  isValidElement,
  type ErrorInfo,
  type ReactElement,
  type ReactNode,
} from "react";

// Props the boundary injects into the fallback element when a child throws.
// Both are optional so callers can construct the element with only its own
// props (e.g. an i18n dictionary); the boundary fills these in via cloneElement.
export type ErrorFallbackProps = {
  error?: Error;
  reset?: () => void;
};

type ErrorBoundaryProps = Readonly<{
  children: ReactNode;
  // A React element rendered in place of `children` when a descendant throws.
  // The boundary injects `error` and a `reset` callback (which clears the error
  // so the subtree re-mounts) into it via cloneElement. Passing an element —
  // not an inline render function — keeps call sites free of nested component
  // definitions (sonar typescript:S6478).
  fallback: ReactElement<ErrorFallbackProps>;
  // Optional hook for logging/telemetry. React still logs to the console.
  onError?: (error: Error, info: ErrorInfo) => void;
}>;

type ErrorBoundaryState = { error: Error | null };

// React error boundaries must be class components — there is no hook equivalent
// for componentDidCatch. This contains a render-time crash to the wrapped
// subtree instead of letting it unmount the whole route (Next.js otherwise
// surfaces a full-page "This page couldn't load" fallback).
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info);
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (error) {
      const { fallback } = this.props;
      return isValidElement(fallback)
        ? cloneElement(fallback, { error, reset: this.reset })
        : fallback;
    }
    return this.props.children;
  }
}
