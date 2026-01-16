import React, { useEffect, useState } from 'react';
import { Rocket, RefreshCw, X, GitCommit, ArrowRight } from 'lucide-react';
import { useUpdateChecker } from '../hooks/useUpdateChecker';
import { useLocation } from 'react-router-dom';

export const UpdateNotification: React.FC = () => {
    const { hasUpdate, updateInfo, updateNow, dismiss } = useUpdateChecker();
    const [visible, setVisible] = useState(false);
    const location = useLocation();

    useEffect(() => {
        if (hasUpdate) {
            // Small delay to animate in nicelt
            const t = setTimeout(() => setVisible(true), 500);
            return () => clearTimeout(t);
        } else {
            setVisible(false);
        }
    }, [hasUpdate]);

    if (!hasUpdate) return null;

    // Don't show covering the map controls if possible, or adjust position
    // On mobile we might want it at top if bottom nav exists?
    // Let's stick to a floating card at bottom right for desktop, bottom center for mobile (above nav)

    return (
        <div className={`fixed z-[100] transition-all duration-500 transform ${visible ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'} 
      bottom-20 left-4 right-4 md:left-auto md:right-8 md:bottom-8 md:w-96`}>

            <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-sky-100 dark:border-sky-900 shadow-2xl rounded-2xl overflow-hidden ring-1 ring-black/5">
                {/* Progress Bar / Decorative Top */}
                <div className="h-1 w-full bg-gradient-to-r from-sky-400 via-purple-400 to-sky-400 animate-gradient-x"></div>

                <div className="p-5">
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sky-400 to-indigo-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-sky-500/20 text-white">
                            <Rocket size={24} className="animate-bounce-subtle" />
                        </div>

                        <div className="flex-1 min-w-0">
                            <h3 className="font-black text-lg text-slate-800 dark:text-white leading-tight mb-1">
                                Ny uppdatering!
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-3">
                                En ny version av Resmus är tillgänglig.
                            </p>

                            {updateInfo?.message && (
                                <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-2.5 mb-2 border border-slate-200 dark:border-slate-700">
                                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                                        <GitCommit size={10} />
                                        <span>Nytt i denna version</span>
                                    </div>
                                    <p className="text-sm text-slate-700 dark:text-slate-200 font-medium line-clamp-2">
                                        {updateInfo.message}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-3 mt-2">
                        <button
                            onClick={dismiss}
                            className="flex-1 px-4 py-2.5 rounded-xl font-bold text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                            Senare
                        </button>
                        <button
                            onClick={updateNow}
                            className="flex-1 px-4 py-2.5 rounded-xl font-bold text-sm text-white bg-sky-500 hover:bg-sky-400 active:bg-sky-600 transition-all shadow-lg shadow-sky-500/25 flex items-center justify-center gap-2"
                        >
                            <RefreshCw size={16} />
                            Uppdatera nu
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
