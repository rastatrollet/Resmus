import React, { useRef, useEffect } from 'react';
import { X, Clock, MapPin, AlertTriangle } from 'lucide-react';
import { useJourneyDetails } from '../hooks/useJourneyDetails';
import { ThemedSpinner } from './Loaders';

interface TripDetailsModalProps {
    journeyRef: string | null;
    onClose: () => void;
    line?: string;
    destination?: string;
}

export const TripDetailsModal: React.FC<TripDetailsModalProps> = ({ journeyRef, onClose, line, destination }) => {
    const { loading, error, details } = useJourneyDetails(journeyRef);
    const modalRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        if (journeyRef) {
            document.addEventListener('mousedown', handleClickOutside);
            // Prevent body scroll
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.body.style.overflow = 'unset';
        };
    }, [journeyRef, onClose]);

    if (!journeyRef) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                ref={modalRef}
                className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] border border-white/20 dark:border-white/10"
            >
                {/* Header */}
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white/50 dark:bg-slate-900/50 backdrop-blur-md">
                    <div>
                        <div className="flex items-center gap-3">
                            {line && (
                                <div className="bg-sky-500 text-white font-black text-lg h-8 min-w-[2rem] px-2 rounded-lg flex items-center justify-center shadow-sm shadow-sky-500/30">
                                    {line}
                                </div>
                            )}
                            <h2 className="text-lg font-bold text-slate-800 dark:text-white leading-tight">
                                {destination ? `Mot ${destination}` : 'Resedetaljer'}
                            </h2>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="overflow-y-auto p-0 flex-1 bg-slate-50 dark:bg-slate-950">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <ThemedSpinner size={32} />
                            <p className="mt-4 text-slate-500 text-sm font-medium">Hämtar hållplatser...</p>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center text-red-500 mb-3">
                                <AlertTriangle size={24} />
                            </div>
                            <p className="text-slate-800 dark:text-white font-medium">Kunde inte hämta detaljer</p>
                            <p className="text-sm text-slate-500 mt-1">Försök igen senare. informationen kanske inte är tillgänglig.</p>
                        </div>
                    ) : details?.stops ? (
                        <div className="py-6 px-2 sm:px-4">
                            <div className="relative pl-6 sm:pl-8 space-y-0">
                                {/* Vertical Line */}
                                <div className="absolute left-6 sm:left-8 top-4 bottom-4 w-0.5 bg-slate-200 dark:bg-slate-800 -translate-x-1/2 z-0"></div>

                                {details.stops.map((stop, idx) => {
                                    const isFirst = idx === 0;
                                    const isLast = idx === details.stops.length - 1;

                                    // Determine time to show
                                    // For first stop: Departure
                                    // For last stop: Arrival
                                    // For middle: Both or Departure? Usually Departure is most relevant for progression
                                    // Resrobot gives both. 

                                    const depTime = stop.rtDepTime || stop.depTime;
                                    const arrTime = stop.rtArrTime || stop.arrTime;
                                    const time = isLast ? arrTime : (depTime || arrTime);

                                    const originalTime = isLast ? stop.arrTime : (stop.depTime || stop.arrTime);
                                    const isLate = time && originalTime && time !== originalTime;

                                    return (
                                        <div key={stop.id} className="relative z-10 flex group mb-6 hover:bg-white dark:hover:bg-slate-900/50 p-2 rounded-xl transition-colors">
                                            {/* Dot */}
                                            <div className="absolute left-6 sm:left-8 top-5 -translate-x-1/2 w-4 h-4 rounded-full border-[3px] border-white dark:border-slate-950 shadow-sm z-20 box-content bg-slate-300 dark:bg-slate-700 group-hover:bg-sky-500 transition-colors">
                                                {isFirst && <div className="absolute inset-0 bg-sky-500 rounded-full"></div>}
                                                {isLast && <div className="absolute inset-0 bg-slate-800 dark:bg-white rounded-full"></div>}
                                            </div>

                                            <div className="ml-10 sm:ml-12 flex-1">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <h4 className={`font-bold text-sm ${isFirst || isLast ? 'text-slate-900 dark:text-white text-base' : 'text-slate-700 dark:text-slate-300'}`}>
                                                            {stop.name}
                                                        </h4>
                                                        {stop.track && (
                                                            <span className="inline-block mt-0.5 px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-bold rounded uppercase">
                                                                Läge {stop.track}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-right">
                                                        <div className={`font-mono font-bold text-sm ${isLate ? 'text-amber-500' : 'text-slate-900 dark:text-white'}`}>
                                                            {time}
                                                        </div>
                                                        {isLate && (
                                                            <div className="text-[10px] text-slate-400 line-through">
                                                                {originalTime}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
};
