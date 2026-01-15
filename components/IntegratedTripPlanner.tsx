import React, { useState, useEffect } from 'react';
import { Search, Clock, MapPin, Loader2, AlertCircle, Bus, TramFront, Ship, Footprints, ArrowUpDown, X, CalendarClock, ChevronRight, Flag, AlertTriangle } from 'lucide-react';
import { TransitService } from '../services/transitService';
import { Station, Journey, TripLeg } from '../types';
import { JourneySkeleton, ThemedSpinner } from './Loaders';

export const IntegratedTripPlanner: React.FC = () => {
    const [fromQuery, setFromQuery] = useState('');
    const [toQuery, setToQuery] = useState('');
    const [fromStation, setFromStation] = useState<Station | null>(null);
    const [toStation, setToStation] = useState<Station | null>(null);

    const [searchResultsFrom, setSearchResultsFrom] = useState<Station[]>([]);
    const [searchResultsTo, setSearchResultsTo] = useState<Station[]>([]);

    const [journeys, setJourneys] = useState<Journey[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasSearched, setHasSearched] = useState(false);
    const [expandedJourneyId, setExpandedJourneyId] = useState<string | null>(null);

    // Location State
    const [gettingLocation, setGettingLocation] = useState(false);

    // Time Selection States
    const [timeMode, setTimeMode] = useState<'now' | 'later'>('now');

    // Helper to get local date string YYYY-MM-DD
    const getLocalDate = () => {
        const d = new Date();
        const offset = d.getTimezoneOffset() * 60000;
        const local = new Date(d.getTime() - offset);
        return local.toISOString().split('T')[0];
    };

    const [tripDate, setTripDate] = useState(getLocalDate);
    const [tripTime, setTripTime] = useState(() => {
        const now = new Date();
        return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    });

    // Simple debounce for search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (fromQuery.length > 2 && !fromStation) {
                handleSearchLocation(fromQuery, setSearchResultsFrom);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [fromQuery, fromStation]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (toQuery.length > 2 && !toStation) {
                handleSearchLocation(toQuery, setSearchResultsTo);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [toQuery, toStation]);

    const handleSearchLocation = async (q: string, setResults: (s: Station[]) => void) => {
        try {
            const results = await TransitService.searchStations(q);
            setResults(results);
        } catch (err) {
            console.error("Search failed", err);
            setResults([]);
        }
    };

    const handleUseMyLocation = () => {
        if (!navigator.geolocation) return;
        setGettingLocation(true);
        navigator.geolocation.getCurrentPosition(async (pos) => {
            try {
                const nearby = await TransitService.getNearbyStations(pos.coords.latitude, pos.coords.longitude);
                if (nearby.length > 0) {
                    setFromStation(nearby[0]); // Set closest station
                    setFromQuery(nearby[0].name);
                    setSearchResultsFrom([]);
                }
            } catch (e) {
                console.error("Loc error", e);
            } finally {
                setGettingLocation(false);
            }
        }, (err) => {
            console.error("Geo error", err);
            setGettingLocation(false);
        });
    };

    const handleReverse = () => {
        const tempQuery = fromQuery;
        setFromQuery(toQuery);
        setToQuery(tempQuery);
        const tempStation = fromStation;
        setFromStation(toStation);
        setToStation(tempStation);
    };

    const handlePlanTrip = async () => {
        if (!fromStation || !toStation) return;
        setLoading(true);
        setError(null);
        setJourneys([]);
        setHasSearched(false);
        setExpandedJourneyId(null);
        try {
            let isoDateTime = undefined;
            if (timeMode === 'later') {
                isoDateTime = `${tripDate}T${tripTime}:00`;
            }

            const results = await TransitService.planTrip(fromStation.id, toStation.id, isoDateTime);
            if (results.length === 0) {
                setError("Inga resor hittades för den valda tiden/rutten.");
            }
            setJourneys(results);
        } catch (e) {
            console.error("Plan trip error", e);
            setError("Kunde inte söka resa. Kontrollera din anslutning.");
        } finally {
            setLoading(false);
            setHasSearched(true);
        }
    };

    // PREMIUM ICON STYLE
    const getTransportIcon = (type: string, size = 18) => {
        const t = type.toUpperCase();
        let Icon = Bus;
        if (t.includes('TRAM')) Icon = TramFront;
        else if (t.includes('FERRY') || t.includes('BOAT')) Icon = Ship;
        else if (t === 'WALK') Icon = Footprints;

        return <Icon size={size} />;
    };

    const calculateDuration = (start: string, end: string) => {
        try {
            const [h1, m1] = start.split(':').map(Number);
            const [h2, m2] = end.split(':').map(Number);
            let diffMinutes = (h2 * 60 + m2) - (h1 * 60 + m1);
            if (diffMinutes < 0) diffMinutes += 24 * 60;
            const h = Math.floor(diffMinutes / 60);
            const m = diffMinutes % 60;
            if (h > 0) return `${h} h ${m} min`;
            return `${m} min`;
        } catch { return "-"; }
    };

    const countTransfers = (legs: TripLeg[]) => {
        const vehicles = legs.filter(l => l.type !== 'WALK');
        return Math.max(0, vehicles.length - 1);
    };

    return (
        <div className="flex flex-col h-full relative space-y-4">
            {/* --- Premium Search Box --- */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-black/40 border border-slate-100 dark:border-slate-800 p-5 relative overflow-hidden">
                {/* Decorative Background Blur */}
                <div className="absolute -right-10 -top-10 w-40 h-40 bg-sky-500/10 rounded-full blur-3xl pointer-events-none"></div>

                <div className="relative z-10">
                    <div className="flex flex-col gap-3">
                        {/* Visual Connector Line */}
                        <div className="absolute left-[1.15rem] top-10 bottom-10 w-[2px] bg-gradient-to-b from-slate-300 via-slate-200 to-sky-500 dark:from-slate-600 dark:to-sky-900 rounded-full"></div>

                        {/* FROM Input */}
                        <div className="relative group">
                            <div className={`flex items-center bg-slate-50 dark:bg-slate-950 rounded-2xl p-2.5 border transition-all duration-300 ${fromStation ? 'border-sky-500/30 bg-sky-50/50 dark:bg-slate-900 shadow-sm' : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                                <div className="w-10 flex items-center justify-center flex-shrink-0">
                                    <div className="w-3 h-3 border-[3px] border-slate-400 dark:border-slate-500 rounded-full bg-white dark:bg-slate-900 shadow-sm"></div>
                                </div>
                                <input
                                    type="text"
                                    placeholder="Var reser du ifrån?"
                                    className="flex-1 bg-transparent outline-none text-slate-800 dark:text-slate-100 font-bold text-base placeholder:text-slate-400 placeholder:font-medium"
                                    value={fromStation ? fromStation.name : fromQuery}
                                    onChange={(e) => {
                                        setFromQuery(e.target.value);
                                        setFromStation(null);
                                    }}
                                />
                                {fromStation || fromQuery ? (
                                    <button onClick={() => { setFromStation(null); setFromQuery(''); }} className="p-2 text-slate-400 hover:text-red-500 transition-colors"><X size={18} /></button>
                                ) : (
                                    <button
                                        onClick={handleUseMyLocation}
                                        disabled={gettingLocation}
                                        className="p-2 text-slate-400 hover:text-sky-500 transition-colors disabled:opacity-50"
                                    >
                                        {gettingLocation ? <Loader2 size={18} className="animate-spin" /> : <MapPin size={18} />}
                                    </button>
                                )}
                            </div>

                            {/* Dropdown */}
                            {searchResultsFrom.length > 0 && !fromStation && (
                                <div className="absolute top-full left-10 right-0 bg-white dark:bg-slate-900 shadow-2xl rounded-xl mt-2 z-50 max-h-[250px] overflow-y-auto border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
                                    {searchResultsFrom.map((s, i) => (
                                        <button key={i} onClick={() => { setFromStation(s); setSearchResultsFrom([]); }} className="w-full text-left px-4 py-3 border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 flex items-center gap-2">
                                            <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">{s.name}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* TO Input */}
                        <div className="relative group">
                            <div className={`flex items-center bg-slate-50 dark:bg-slate-950 rounded-2xl p-2.5 border transition-all duration-300 ${toStation ? 'border-sky-500/30 bg-sky-50/50 dark:bg-slate-900 shadow-sm' : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                                <div className="w-10 flex items-center justify-center flex-shrink-0">
                                    <MapPin size={18} className="text-sky-500 fill-sky-500/20" />
                                </div>
                                <input
                                    type="text"
                                    placeholder="Vart vill du åka?"
                                    className="flex-1 bg-transparent outline-none text-slate-800 dark:text-slate-100 font-bold text-base placeholder:text-slate-400 placeholder:font-medium"
                                    value={toStation ? toStation.name : toQuery}
                                    onChange={(e) => {
                                        setToQuery(e.target.value);
                                        setToStation(null);
                                    }}
                                />
                                {toStation || toQuery ? <button onClick={() => { setToStation(null); setToQuery(''); }} className="p-2 text-slate-400 hover:text-red-500 transition-colors"><X size={18} /></button> : null}
                            </div>

                            {/* Dropdown */}
                            {searchResultsTo.length > 0 && !toStation && (
                                <div className="absolute top-full left-10 right-0 bg-white dark:bg-slate-900 shadow-2xl rounded-xl mt-2 z-50 max-h-[250px] overflow-y-auto border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
                                    {searchResultsTo.map((s, i) => (
                                        <button key={i} onClick={() => { setToStation(s); setSearchResultsTo([]); }} className="w-full text-left px-4 py-3 border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 flex items-center gap-2">
                                            <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">{s.name}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Swap Button */}
                        <button
                            onClick={handleReverse}
                            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 p-2.5 rounded-xl text-slate-400 hover:text-sky-500 shadow-sm hover:shadow-md transition-all hover:scale-110 active:rotate-180"
                        >
                            <ArrowUpDown size={16} strokeWidth={2.5} />
                        </button>
                    </div>

                    {/* Controls Row */}
                    <div className="flex items-center gap-3 mt-4">
                        <div className="flex-1 bg-slate-100 dark:bg-slate-950/50 p-1.5 rounded-xl flex items-center">
                            <button
                                onClick={() => setTimeMode('now')}
                                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${timeMode === 'now' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                            >
                                Nu
                            </button>
                            <button
                                onClick={() => setTimeMode('later')}
                                className={`flex-1 px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${timeMode === 'later' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                            >
                                {timeMode === 'later' ? (
                                    <span className="truncate">{tripTime}</span>
                                ) : (
                                    <>
                                        <CalendarClock size={14} />
                                        <span>Annat datum</span>
                                    </>
                                )}
                            </button>
                        </div>

                        <button
                            disabled={!fromStation || !toStation || loading}
                            onClick={handlePlanTrip}
                            className="bg-sky-500 hover:bg-sky-600 dark:bg-sky-600 dark:hover:bg-sky-500 disabled:opacity-50 disabled:bg-slate-300 text-white font-black px-6 py-3 rounded-xl shadow-lg shadow-sky-500/25 transition-all flex items-center justify-center gap-2 active:scale-95"
                        >
                            {loading ? <ThemedSpinner size={20} className="text-white" /> : <Search size={20} strokeWidth={3} />}
                        </button>
                    </div>

                    {/* Time Picker */}
                    {timeMode === 'later' && (
                        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-3 animate-in slide-in-from-top-2 fade-in duration-200">
                            <input type="date" value={tripDate} onChange={(e) => setTripDate(e.target.value)} className="bg-slate-50 dark:bg-slate-950 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 dark:text-white outline-none border border-transparent focus:border-sky-500 transition-colors" />
                            <input type="time" value={tripTime} onChange={(e) => setTripTime(e.target.value)} className="bg-slate-50 dark:bg-slate-950 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 dark:text-white outline-none border border-transparent focus:border-sky-500 transition-colors text-center" />
                        </div>
                    )}

                    {error && (
                        <div className="mt-3 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-xl p-3 flex items-start gap-3 animate-in fade-in">
                            <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={16} />
                            <span className="text-xs font-bold text-red-800 dark:text-red-300">{error}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* --- Results --- */}
            <div className="flex-1 space-y-3 pb-20">
                {loading && (
                    <div className="animate-in fade-in duration-300 space-y-3 pt-2">
                        <JourneySkeleton />
                        <JourneySkeleton />
                    </div>
                )}

                {journeys.map((j) => {
                    const transfers = countTransfers(j.legs);
                    const duration = calculateDuration(j.startTime, j.endTime);
                    const isExpanded = expandedJourneyId === j.id;

                    return (
                        <div key={j.id} className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden relative group transition-all hover:shadow-md animate-in fade-in slide-in-from-bottom-4">
                            <div onClick={() => setExpandedJourneyId(isExpanded ? null : j.id)} className="p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                {/* Times & Duration */}
                                <div className="flex justify-between items-center mb-3">
                                    <div className="flex items-center gap-2">
                                        <span className="font-black text-xl text-slate-800 dark:text-white tracking-tight">{j.startTime}</span>
                                        <div className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-600"></div>
                                        <span className="font-bold text-lg text-slate-400">{j.endTime}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">
                                        <Clock size={12} className="text-slate-400" />
                                        <span className="font-bold text-sm text-slate-700 dark:text-slate-200">{duration}</span>
                                    </div>
                                </div>

                                {/* Legs Visualization */}
                                <div className="flex items-center gap-1 mb-3 overflow-hidden">
                                    {j.legs.map((leg, lIdx) => {
                                        if (leg.type === 'WALK') {
                                            if (leg.duration < 4) return <div key={lIdx} className="w-1 h-1 rounded-full bg-slate-200 dark:bg-slate-700 mx-0.5"></div>;
                                            return <div key={lIdx} className="text-slate-300 dark:text-slate-600 p-0.5"><Footprints size={10} /></div>;
                                        }
                                        return (
                                            <div key={lIdx} className="h-6 px-1.5 rounded flex items-center justify-center text-white text-[10px] font-black shadow-sm" style={{ backgroundColor: leg.bgColor || '#0ea5e9', color: leg.fgColor }}>
                                                <span className="mr-1">{getTransportIcon(leg.type, 10)}</span>
                                                {leg.name.replace(/\D/g, '') || leg.name.substring(0, 3)}
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Footer */}
                                <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
                                    <div className="flex items-center gap-2">
                                        {transfers === 0 ? <span className="text-green-600 dark:text-green-400">Inga byten</span> : <span>{transfers} byten</span>}
                                    </div>
                                    <ChevronRight size={16} className={`transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`} />
                                </div>
                            </div>

                            {/* Detailed View */}
                            {isExpanded && (
                                <div className="bg-slate-50/50 dark:bg-black/20 p-4 border-t border-slate-100 dark:border-slate-800">
                                    <div className="relative space-y-0">
                                        <div className="absolute left-[2.25rem] top-2 bottom-4 w-0.5 bg-slate-200 dark:bg-slate-800"></div>
                                        {j.legs.map((leg, idx) => (
                                            <div key={idx} className="relative pb-6 last:pb-0">
                                                <div className="flex gap-3">
                                                    <div className="w-8 text-right font-bold text-[10px] text-slate-500 pt-0.5">{leg.origin.time}</div>
                                                    <div className={`relative z-10 w-2.5 h-2.5 rounded-full border-2 ${leg.type === 'WALK' ? 'bg-slate-100 border-slate-300' : 'bg-white border-sky-500'} mt-0.5`}></div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-bold text-sm text-slate-900 dark:text-white leading-tight">{leg.origin.name}</div>
                                                        <div className={`mt-2 p-2 rounded-lg border flex items-center gap-2 ${leg.type === 'WALK' ? 'bg-transparent border-dashed border-slate-300' : 'bg-white dark:bg-slate-800 border-slate-100 shadow-sm'}`}>
                                                            {getTransportIcon(leg.type, 14)}
                                                            <div className="text-xs font-bold text-slate-700 dark:text-slate-300">{leg.type === 'WALK' ? `Gå ${leg.duration} min` : `${leg.name} mot ${leg.direction}`}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}


            </div>
        </div>
    );
};
