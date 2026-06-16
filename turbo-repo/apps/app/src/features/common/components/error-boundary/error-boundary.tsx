"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type ErrorBoundaryProps = Readonly<{
  children: ReactNode;
  // Rendered in place of `children` when a descendant throws during render or in
  // a lifecycle method. `reset` clears the captured error so the subtree
  // re-mounts — wire it to a "retry" control in the fallback.
  fallback: (error: Error, reset: () => void) => ReactNode;
  // Optional hook for logging/telemetry. React still logs the error to the
  // console; this is for sending it somewhere durable.
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
      return this.props.fallback(error, this.reset);
    }
    return this.props.children;
  }
}
