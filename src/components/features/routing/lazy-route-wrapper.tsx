'use client';

import { Suspense, lazy, ComponentType, Component, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

// Simple error boundary implementation
class SimpleErrorBoundary extends Component<
  { 
    fallback: React.ComponentType<{ error: Error; resetErrorBoundary: () => void }>;
    onReset?: () => void;
    children: ReactNode;
  },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError && this.state.error) {
      const FallbackComponent = this.props.fallback;
      return (
        <FallbackComponent 
          error={this.state.error} 
          resetErrorBoundary={() => {
            this.setState({ hasError: false, error: null });
            this.props.onReset?.();
          }} 
        />
      );
    }

    return this.props.children;
  }
}

interface LazyRouteWrapperProps {
  fallback?: React.ReactNode;
  errorFallback?: React.ComponentType<{ error: Error; resetErrorBoundary: () => void }>;
  preload?: boolean;
}

/**
 * Creates a lazy-loaded route component with suspense and error boundaries
 * Improves routing performance by splitting route-level bundles
 */
export function createLazyRoute<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  options: LazyRouteWrapperProps = {}
) {
  const LazyComponent = lazy(importFn);

  const {
    fallback = <RouteLoadingFallback />,
    errorFallback = RouteErrorFallback,
    preload = false
  } = options;

  // Preload the component if requested
  if (preload && typeof window !== 'undefined') {
    importFn();
  }

  const WrappedComponent = (props: any) => (
    <SimpleErrorBoundary fallback={errorFallback} onReset={() => window.location.reload()}>
      <Suspense fallback={fallback}>
        <LazyComponent {...props} />
      </Suspense>
    </SimpleErrorBoundary>
  );

  // Expose preload method for manual preloading
  WrappedComponent.preload = importFn;

  return WrappedComponent;
}

/**
 * Default loading fallback for routes
 */
function RouteLoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="flex flex-col items-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

/**
 * Default error fallback for routes
 */
function RouteErrorFallback({ 
  error, 
  resetErrorBoundary 
}: { 
  error: Error; 
  resetErrorBoundary: () => void; 
}) {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center space-y-4 max-w-md mx-auto p-6">
        <h2 className="text-xl font-semibold text-destructive">
          Route Loading Error
        </h2>
        <p className="text-sm text-muted-foreground">
          Failed to load this page. Please try again.
        </p>
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer hover:text-foreground">
            Technical Details
          </summary>
          <pre className="mt-2 p-2 bg-muted rounded text-left overflow-auto">
            {error.message}
          </pre>
        </details>
        <button
          onClick={resetErrorBoundary}
          className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}

/**
 * High-priority routes that should be preloaded
 */
export const HighPriorityRoute = {
  create: <T extends ComponentType<any>>(importFn: () => Promise<{ default: T }>) =>
    createLazyRoute(importFn, { preload: true })
};

/**
 * Low-priority routes with minimal loading state
 */
export const LowPriorityRoute = {
  create: <T extends ComponentType<any>>(importFn: () => Promise<{ default: T }>) =>
    createLazyRoute(importFn, { 
      fallback: <div className="animate-pulse h-4 bg-muted rounded w-full" />,
      preload: false 
    })
}; 