import { useRef, useEffect, useState } from 'react';
import { ArrowLeft, Trophy, Map, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const StatisticsView = () => {
    const navigate = useNavigate();
    const [trips, setTrips] = useState(0);

    useEffect(() => {
        const savedTrips = localStorage.getItem('resmus_trip_count');
        setTrips(savedTrips ? parseInt(savedTrips) : 0);
    }, []);

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans pb-20">
            {/* Header */}
            <div className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 safe-area-top">
                <div className="flex items-center justify-between px-4 h-14">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 -ml-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <h1 className="font-black text-lg tracking-tight bg-gradient-to-r from-sky-600 to-indigo-600 bg-clip-text text-transparent">
                        Din Resa
                    </h1>
                    <div className="w-9" /> {/* Spacer */}
                </div>
            </div>

            <div className="p-4 space-y-4">
                {/* Main Stat Card */}
                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg shadow-indigo-500/20">
                    <div className="flex items-start justify-between">
                        <div>
                            <h2 className="text-indigo-100 font-medium text-sm uppercase tracking-wider mb-1">Totalt Antal Resor</h2>
                            <div className="text-5xl font-black">{trips}</div>
                        </div>
                        <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
                            <Trophy size={32} className="text-yellow-300" />
                        </div>
                    </div>
                    <div className="mt-6 flex items-center gap-2 text-indigo-100 text-sm">
                        <span className="bg-white/20 px-2 py-0.5 rounded text-white font-bold">+2</span>
                        <span>denna veckan</span>
                    </div>
                </div>

                {/* Grid Stats */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
                        <div className="flex items-center gap-2 mb-3 text-sky-600">
                            <Map size={18} />
                            <span className="font-bold text-xs uppercase tracking-wider text-slate-400">Sträcka</span>
                        </div>
                        <div className="text-2xl font-black text-slate-800 dark:text-white">42 <span className="text-sm font-medium text-slate-400">km</span></div>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
                        <div className="flex items-center gap-2 mb-3 text-emerald-600">
                            <Clock size={18} />
                            <span className="font-bold text-xs uppercase tracking-wider text-slate-400">Tid</span>
                        </div>
                        <div className="text-2xl font-black text-slate-800 dark:text-white">8.5 <span className="text-sm font-medium text-slate-400">h</span></div>
                    </div>
                </div>
            </div>
        </div>
    );
};
