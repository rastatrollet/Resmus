import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

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
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl p-8 border border-slate-100 dark:border-slate-800 text-center animate-in zoom-in-95 duration-300">
            <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
              <AlertTriangle size={40} strokeWidth={2.5} />
            </div>
            
            <h1 className="text-2xl font-black text-slate-800 dark:text-white mb-3">Ojdå, något gick snett.</h1>
            <p className="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
              Resmus stötte på ett oväntat problem. Vi ber om ursäkt för detta.
            </p>

            <div className="flex flex-col gap-3">
              <button 
                onClick={this.handleReload}
                className="w-full bg-sky-500 hover:bg-sky-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-sky-500/20 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
              >
                <RefreshCw size={20} /> Försök igen
              </button>
              
              <button 
                onClick={this.handleReset}
                className="w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <Home size={20} /> Gå till startsidan
              </button>
            </div>
            
            {this.state.error && (
                <div className="mt-8 p-4 bg-slate-100 dark:bg-slate-950 rounded-xl text-left overflow-hidden">
                    <p className="text-[10px] font-mono text-slate-400 break-all">
                        {this.state.error.toString()}
                    </p>
                </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}