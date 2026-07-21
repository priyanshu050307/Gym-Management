import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/dashboard';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-6">
          <div className="max-w-md w-full glass-card p-8 rounded-3xl border border-white/10 text-center space-y-6 bg-slate-800/80 shadow-2xl backdrop-blur-xl">
            <div className="h-16 w-16 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl flex items-center justify-center mx-auto animate-pulse">
              <AlertTriangle className="h-8 w-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight text-white">Something went wrong</h2>
              <p className="text-sm text-slate-400">
                Gymnasium encountered an unexpected rendering exception. Your session data is preserved.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 bg-slate-950/60 rounded-xl text-left border border-white/5 font-mono text-xs text-red-300 overflow-x-auto max-h-32">
                {this.state.error.message}
              </div>
            )}

            <div className="flex gap-3 justify-center pt-2">
              <button
                onClick={this.handleReload}
                className="px-5 py-2.5 bg-gym-primary text-black font-bold rounded-xl text-sm hover:opacity-90 transition-all flex items-center gap-2 cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" /> Reload Page
              </button>
              <button
                onClick={this.handleGoHome}
                className="px-5 py-2.5 bg-slate-700 text-white font-bold rounded-xl text-sm hover:bg-slate-600 transition-all flex items-center gap-2 cursor-pointer"
              >
                <Home className="h-4 w-4" /> Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
