import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.fallback) {
        return this.fallback;
      }
      return (
        <div className="min-h-screen bg-black flex items-center justify-center p-6 text-center">
          <div className="max-w-md w-full space-y-6">
            <div className="w-20 h-20 bg-red-600/10 rounded-full flex items-center justify-center mx-auto border border-red-600/20">
              <span className="text-4xl">⚠️</span>
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-black uppercase tracking-tighter text-white">Упс! Щось пішло не так</h1>
              <p className="text-zinc-500 text-sm">
                Сталася помилка при завантаженні сторінки. Спробуйте оновити сторінку або повернутися на головну.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => window.location.reload()}
                className="w-full h-14 bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest text-xs rounded-2xl transition-all"
              >
                Оновити сторінку
              </button>
              <button 
                onClick={() => window.location.href = '/'}
                className="w-full h-14 bg-zinc-900 hover:bg-zinc-800 text-white font-black uppercase tracking-widest text-xs rounded-2xl transition-all border border-white/5"
              >
                На головну
              </button>
            </div>
            {process.env.NODE_ENV === 'development' && (
              <pre className="mt-8 p-4 bg-zinc-900 rounded-xl text-left text-[10px] text-red-400 overflow-auto max-h-40 border border-red-900/20">
                {this.state.error?.toString()}
              </pre>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }

  private get fallback() {
    return this.props.fallback;
  }
}
