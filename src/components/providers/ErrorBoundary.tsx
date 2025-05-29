"use client";
import * as Sentry from "@sentry/nextjs";
import { ErrorBoundary as SentryErrorBoundary } from "@sentry/react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export function GlobalErrorBoundary({ children }: { children: React.ReactNode }) {
    return (
        <SentryErrorBoundary
            fallback={({ error, resetError }) => (
                <div className="min-h-screen flex items-center justify-center bg-background">
                    <div className="text-center max-w-md mx-auto p-6">
                        <div className="flex justify-center mb-4">
                            <AlertTriangle className="h-12 w-12 text-destructive" />
                        </div>
                        <h2 className="text-xl font-semibold mb-2 text-foreground">
                            Something went wrong
                        </h2>
                        <p className="text-muted-foreground mb-6">
                            We've been notified about this error and are working to fix it.
                        </p>
                        <button
                            onClick={resetError}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                        >
                            <RefreshCw className="h-4 w-4" />
                            Try again
                        </button>
                    </div>
                </div>
            )}
            beforeCapture={(scope) => {
                scope.setTag("errorBoundary", true);
                scope.setLevel("error");
            }}
        >
            {children}
        </SentryErrorBoundary>
    );
} 