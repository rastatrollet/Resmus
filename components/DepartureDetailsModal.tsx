import React, { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faMap, faClock, faBus, faExclamationTriangle, faTram } from '@fortawesome/free-solid-svg-icons';
import { Departure, JourneyDetail } from '../types';
import { useTripDetails } from '../hooks/useTripDetails';
import { ThemedSpinner } from './Loaders';
import { useAlarms } from '../hooks/useAlarms';
import { useToast } from './ToastProvider';
// Lazy load map to improve perf
const DepartureRouteMap = React.lazy(() => import('./DepartureRouteMap').then(module => ({ default: module.DepartureRouteMap })));

interface DepartureDetailsModalProps {
    departure: Departure;
    onClose: () => void;
    stationName?: string;
}

export const DepartureDetailsModal: React.FC<DepartureDetailsModalProps> = ({ departure, onClose, stationName }) => {
    // Use the hook for fetching
    const { stops, loading, error } = useTripDetails(departure.journeyDetailRefUrl || null);

    const [showRouteMap, setShowRouteMap] = useState(false);
    const { addAlarm } = useAlarms();
    const toast = useToast();

    // Convert SimplifiedStop to JourneyDetail to reuse existing UI or render list directly
    // Since user requested "Simple List mapping" from hook but we might want to keep the UI consistent
    // if possible. However, the existing UI "JourneyTimeline" expects coords/date etc. which we simplified away.
    // So we will render a NEW simple timeline for this Modal if using this hook.

    // Actually, let's keep it robust. If the hook is simple, the UI should handle mapped data.

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div onClick={e => e.stopPropagation()} className="bg-white/90 dark:bg-slate-900/90 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-5 duration-300">

                {/* Header */}
                <div className="bg-white/90 dark:bg-slate-900/90 border-b border-slate-100 dark:border-slate-800 p-4 shrink-0 flex items-start justify-between">
                    <div className="flex items-start">
                        {/* Line Badge */}
                        <div
                            className="h-10 min-w-[3.5rem] px-2 rounded-xl flex items-center justify-center font-black text-2xl shadow-sm border-0 shrink-0 select-none mr-4"
                            style={{
                                backgroundColor: departure.bgColor || '#0ea5e9',
                                color: departure.fgColor || '#ffffff'
                            }}
                        >
                            {departure.line}
                        </div>

                        <div className="flex-1 min-w-0 flex flex-col justify-center pt-0.5">
                            <div className="font-black text-lg leading-6 truncate flex items-center gap-2 text-slate-800 dark:text-white">
                                {departure.direction}
                            </div>
                            <div className="flex items-center gap-3 text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
                                <span className="text-slate-900 dark:text-slate-200 font-bold">
                                    {departure.realtime || departure.time}
                                </span>
                                {departure.track && (
                                    <span className="flex items-center gap-1 pl-3 border-l border-slate-200 dark:border-slate-700">
                                        <span className="text-[10px] uppercase font-bold tracking-wider opacity-60">Läge</span>
                                        <span className="text-slate-900 dark:text-slate-200 font-bold">{departure.track}</span>
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500">
                        <FontAwesomeIcon icon={faTimes} className="text-lg" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 bg-white dark:bg-slate-900 min-h-[300px]">

                    {/* Map Placeholder - Only if we had coords, but simplified stops don't have them. 
                 Show warning or hide? Hide for now as per "simple list" request. 
              */}

                    {loading ? (
                        <div className="flex justify-center py-12">
                            <ThemedSpinner size={32} />
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                            <FontAwesomeIcon icon={faExclamationTriangle} className="text-3xl mb-2" />
                            <p>Kunde inte ladda detaljer</p>
                            <p className="text-xs">{error}</p>
                            {!departure.journeyDetailRefUrl && <p className="text-xs mt-2 text-amber-500">Ingen detalj-URL tillgänglig</p>}
                        </div>
                    ) : stops.length > 0 ? (
                        <div className="py-2">
                            <div className="relative pl-4 border-l-2 border-slate-200 dark:border-slate-800 ml-4 space-y-6">
                                {stops.map((stop, idx) => {
                                    const isCurrent = stop.name === stationName;
                                    return (
                                        <div key={idx} className={`relative ${isCurrent ? 'opacity-100' : 'opacity-80'}`}>
                                            <div className={`absolute -left-[21px] top-1.5 w-3 h-3 rounded-full border-2 ${isCurrent ? 'bg-sky-500 border-sky-500 ring-4 ring-sky-100 dark:ring-sky-900/30' : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600'}`}></div>
                                            <div className="flex items-baseline justify-between">
                                                <div className="font-bold text-slate-800 dark:text-white">
                                                    {stop.name}
                                                </div>
                                                <div className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 text-right">
                                                    {/* Prioritize departure time, fallback to arrival */}
                                                    {stop.departureTime !== '--:--' ? stop.departureTime : stop.arrivalTime}
                                                </div>
                                            </div>
                                            {stop.track && (
                                                <div className="text-[10px] font-bold text-slate-400 mt-0.5">
                                                    Läge {stop.track}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 px-6 text-center text-slate-400">
                            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                                <FontAwesomeIcon icon={faBus} className="text-2xl text-slate-300" />
                            </div>
                            <p className="font-medium text-slate-600 dark:text-slate-300 mb-1">Inga mellanstopp tillgängliga</p>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-4 bg-slate-50 dark:bg-slate-950/50 border-b border-slate-100 dark:border-slate-800 shrink-0 flex justify-end">
                    <button
                        onClick={() => {
                            const dueTime = new Date(departure.timestamp);
                            dueTime.setMinutes(dueTime.getMinutes() - 5);
                            const alarmId = `${departure.id}-${Date.now()}`;

                            addAlarm({
                                id: alarmId,
                                departureTime: departure.timestamp,
                                dueTime: dueTime.getTime(),
                                stationName: stationName || 'Okänd',
                                line: departure.line,
                                direction: departure.direction,
                                journeyRef: departure.journeyRef
                            });
                            toast.success('Larm satt', 'Du får notis 5 min innan avgång');
                        }}
                        className="bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-full text-xs font-bold shadow-sm flex items-center gap-2 transition-transform active:scale-95"
                    >
                        <FontAwesomeIcon icon={faClock} />
                        Bevaka
                    </button>
                </div>

            </div>
        </div>
    );
};
