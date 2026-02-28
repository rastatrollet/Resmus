import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { X, CheckCircle2, AlertTriangle, Info, AlertCircle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
    id: string;
    title: string;
    message?: string;
    type: ToastType;
    duration?: number;
}

interface ToastContextType {
    toast: (props: Omit<Toast, 'id'>) => void;
    success: (title: string, message?: string) => void;
    error: (title: string, message?: string) => void;
    warning: (title: string, message?: string) => void;
    info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const addToast = useCallback((props: Omit<Toast, 'id'>) => {
        const id = Date.now().toString() + Math.random().toString(36).substring(2, 9);
        const newToast = { ...props, id };

        setToasts((prev) => [...prev, newToast]);

        if (props.duration !== Infinity) {
            setTimeout(() => {
                removeToast(id);
            }, props.duration || 4000);
        }
    }, [removeToast]);

    const success = (title: string, message?: string) => addToast({ title, message, type: 'success' });
    const error = (title: string, message?: string) => addToast({ title, message, type: 'error' });
    const warning = (title: string, message?: string) => addToast({ title, message, type: 'warning' });
    const info = (title: string, message?: string) => addToast({ title, message, type: 'info' });

    return (
        <ToastContext.Provider value={{ toast: addToast, success, error, warning, info }}>
            {children}
            <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
                {toasts.map((t) => (
                    <div
                        key={t.id}
                        className={`pointer-events-auto transform transition-all duration-300 animate-in slide-in-from-right-10 fade-in
              flex items-start gap-3 p-4 rounded-xl shadow-lg border border-opacity-20 backdrop-blur-md
              ${t.type === 'success' ? 'bg-white/90 dark:bg-slate-900/90 border-green-500 text-slate-800 dark:text-white' : ''}
              ${t.type === 'error' ? 'bg-white/90 dark:bg-slate-900/90 border-red-500 text-slate-800 dark:text-white' : ''}
              ${t.type === 'warning' ? 'bg-white/90 dark:bg-slate-900/90 border-amber-500 text-slate-800 dark:text-white' : ''}
              ${t.type === 'info' ? 'bg-white/90 dark:bg-slate-900/90 border-sky-500 text-slate-800 dark:text-white' : ''}
            `}
                    >
                        <div className="flex-shrink-0 mt-0.5">
                            {t.type === 'success' && <CheckCircle2 size={20} className="text-green-500" />}
                            {t.type === 'error' && <AlertCircle size={20} className="text-red-500" />}
                            {t.type === 'warning' && <AlertTriangle size={20} className="text-amber-500" />}
                            {t.type === 'info' && <Info size={20} className="text-sky-500" />}
                        </div>

                        <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-sm">{t.title}</h4>
                            {t.message && <p className="text-xs text-opacity-80 mt-1 opacity-80">{t.message}</p>}
                        </div>

                        <button
                            onClick={() => removeToast(t.id)}
                            className="flex-shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                            <X size={16} />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};
