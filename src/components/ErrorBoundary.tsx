import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
  details?: {
    operationType?: string;
    path?: string | null;
    error?: string;
  };
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    try {
      const parsed = JSON.parse(error.message);
      return {
        hasError: true,
        message: parsed.error || error.message,
        details: {
          operationType: parsed.operationType,
          path: parsed.path,
          error: parsed.error,
        },
      };
    } catch {
      return {
        hasError: true,
        message: error.message || 'An unexpected application error occurred.',
      };
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--bg-canvas)] text-[var(--text-primary)]">
          <div className="max-w-lg w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-8">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
              <h1 className="text-lg font-semibold">Workspace Error Encountered</h1>
            </div>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-4">
              {this.state.message}
            </p>
            {this.state.details && (
              <div className="mb-6 p-3 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-hairline)] text-xs font-mono-tabular space-y-1">
                <div>Operation: {this.state.details.operationType || 'unknown'}</div>
                <div>Collection Path: {this.state.details.path || 'n/a'}</div>
              </div>
            )}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-hover)] transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reload Workspace</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
