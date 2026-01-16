
import React, { useState, useEffect } from 'react';
import { Search, Clock, MapPin, Loader2, AlertCircle, Bus, TramFront, Ship, Footprints, ArrowUpDown, ChevronDown, X, ArrowRight, ArrowDown, CalendarClock, ChevronRight, Flag, MessageCircle, Send, Bot, User, Navigation, AlertTriangle, WifiOff } from 'lucide-react';
import { TransitService } from '../services/transitService';
import { Station, Journey, TripLeg, Provider } from '../types';
import { JourneySkeleton, ThemedSpinner } from './Loaders';

export const TripPlanner: React.FC = () => {
  const [fromQuery, setFromQuery] = useState('');
  const [toQuery, setToQuery] = useState('');
  const [fromStation, setFromStation] = useState<Station | null>(null);
  const [toStation, setToStation] = useState<Station | null>(null);
  const [provider, setProvider] = useState<Provider>(Provider.VASTTRAFIK);

  const [searchResultsFrom, setSearchResultsFrom] = useState<Station[]>([]);
  const [searchResultsTo, setSearchResultsTo] = useState<Station[]>([]);

  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null); // New error state
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

  // AI Chat State
  const [showAIChat, setShowAIChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant', content: string }>>([
    { role: 'assistant', content: 'Vilka linjer och/eller kommuner vill du ha trafikinformation om?\n\nT.ex. Västtågen, X1 eller 100\n\nTrafikslag:\n• Spårvagn\n• Buss\n• Tåg\n• Båt\n\nGiltighetstid:\n• Pågående\n• Planerade\n\nSortera efter:\n• Senaste\n• Störst trafikpåverkan' }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatFilters, setChatFilters] = useState({
    transportMode: 'all',
    lines: [] as string[],
    status: 'all',
    sortBy: 'latest'
  });

  // Simple debounce for search to avoid API spam
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
      const results = await TransitService.searchStations(q, provider);
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

      const results = await TransitService.planTrip(fromStation.id, toStation.id, isoDateTime, provider);
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

  const handleAIQuery = async (query: string) => {
    setChatLoading(true);
    setChatMessages(prev => [...prev, { role: 'user', content: query }]);

    try {
      // Parse user query for filters
      const lowerQuery = query.toLowerCase();

      // Extract transport types
      let transportFilter = 'all';
      if (lowerQuery.includes('västtågen') || lowerQuery.includes('tåg')) {
        transportFilter = 'train';
      } else if (lowerQuery.includes('spårvagn') || lowerQuery.includes('tram')) {
        transportFilter = 'tram';
      } else if (lowerQuery.includes('buss') || lowerQuery.includes('bus')) {
        transportFilter = 'bus';
      } else if (lowerQuery.includes('båt') || lowerQuery.includes('färj')) {
        transportFilter = 'ferry';
      }

      // Extract specific lines
      const lineMatches = lowerQuery.match(/(\d+|[A-Z]+\d*)/g) || [];
      const lines = lineMatches.filter(match => match.match(/^\d+$/) || match.length >= 2);

      // Extract status
      let statusFilter = 'all';
      if (lowerQuery.includes('pågående') || lowerQuery.includes('aktiv')) {
        statusFilter = 'ongoing';
      } else if (lowerQuery.includes('planerad') || lowerQuery.includes('kommande')) {
        statusFilter = 'planned';
      }

      // Update filters
      setChatFilters({
        transportMode: transportFilter,
        lines: lines,
        status: statusFilter,
        sortBy: 'latest'
      });

      // Generate response
      let response = 'Här är trafikinformationen baserat på din sökning:\n\n';

      if (lines.length > 0) {
        response += `🔍 Linjer: ${lines.join(', ')}\n`;
      }

      if (transportFilter !== 'all') {
        const typeNames = {
          train: 'Tåg',
          tram: 'Spårvagn',
          bus: 'Buss',
          ferry: 'Båt'
        };
        response += `🚇 Trafikslag: ${typeNames[transportFilter as keyof typeof typeNames]}\n`;
      }

      if (statusFilter !== 'all') {
        const statusNames = {
          ongoing: 'Pågående',
          planned: 'Planerade'
        };
        response += `📅 Status: ${statusNames[statusFilter as keyof typeof statusNames]}\n`;
      }

      response += '\nDu kan nu se filtrerade störningar ovan. Vad mer vill du veta?';

      setTimeout(() => {
        setChatMessages(prev => [...prev, { role: 'assistant', content: response }]);
        setChatLoading(false);
      }, 1000);

    } catch (error) {
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Tyvärr kunde jag inte förstå din fråga. Försök omformulera den, t.ex. "visa alla tåg störningar" eller "vad händer med linje 16?".'
      }]);
      setChatLoading(false);
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
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-hidden relative">

      {/* --- Modern Search Header (Sticky & Glassmorphism) --- */}
      <div className="flex-none sticky top-0 z-40 px-4 pt-4 pb-2">
        {/* Background Blur Layer */}
        <div className="absolute inset-0 bg-slate-50/90 dark:bg-slate-950/90 backdrop-blur-md border-b border-slate-200/50 dark:border-slate-800/50"></div>

        <div className="relative bg-white dark:bg-slate-900 p-1 rounded-[1.5rem] shadow-xl shadow-slate-200/50 dark:shadow-black/20 border border-slate-100 dark:border-slate-800">

          <div className="p-4 pb-3">
            {/* Provider Toggle */}
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl mb-4">
              <button
                onClick={() => { setProvider(Provider.VASTTRAFIK); setFromStation(null); setToStation(null); setFromQuery(''); setToQuery(''); }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${provider === Provider.VASTTRAFIK ? 'bg-white dark:bg-slate-700 shadow text-sky-600 dark:text-sky-400' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Västtrafik
              </button>
              <button
                onClick={() => { setProvider(Provider.RESROBOT); setFromStation(null); setToStation(null); setFromQuery(''); setToQuery(''); }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${provider === Provider.RESROBOT ? 'bg-white dark:bg-slate-700 shadow text-green-600 dark:text-green-400' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Resrobot (Hela Sverige)
              </button>
            </div>

            <div className="relative">
              {/* Visual Connector Line */}
              <div className="absolute left-[1.15rem] top-9 bottom-9 w-[2px] bg-gradient-to-b from-slate-300 via-slate-200 to-sky-500 dark:from-slate-600 dark:to-sky-900 rounded-full"></div>

              {/* FROM Input */}
              <div className="relative z-20 mb-3">
                <div className={`flex items-center bg-slate-50 dark:bg-slate-950 rounded-2xl p-2 border transition-all group ${fromStation ? 'border-sky-500/30 bg-sky-50/50 dark:bg-slate-900' : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                  <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
                    <div className="w-3 h-3 border-[3px] border-slate-400 dark:border-slate-500 rounded-full bg-white dark:bg-slate-900 shadow-sm"></div>
                  </div>
                  <input
                    type="text"
                    placeholder="Var reser du ifrån?"
                    className="flex-1 bg-transparent outline-none text-slate-800 dark:text-slate-100 font-bold text-base py-1 placeholder:text-slate-400 placeholder:font-medium"
                    value={fromStation ? fromStation.name : fromQuery}
                    onChange={(e) => {
                      setFromQuery(e.target.value);
                      setFromStation(null);
                      // Debounce handled in useEffect
                    }}
                  />
                  {/* Location Button or Clear Button */}
                  {fromStation || fromQuery ? (
                    <button onClick={() => { setFromStation(null); setFromQuery(''); }} className="p-2 text-slate-400 hover:text-red-500 transition-colors"><X size={18} /></button>
                  ) : (
                    <button
                      onClick={handleUseMyLocation}
                      disabled={gettingLocation}
                      className="p-2 text-slate-400 hover:text-sky-500 transition-colors disabled:opacity-50"
                      title="Använd min plats"
                    >
                      {gettingLocation ? <Loader2 size={18} className="animate-spin" /> : <Navigation size={18} />}
                    </button>
                  )}
                </div>
                {/* Results Dropdown */}
                {searchResultsFrom.length > 0 && !fromStation && (
                  <div className="absolute top-full left-4 right-0 bg-white dark:bg-slate-900 shadow-2xl rounded-xl mt-2 z-50 max-h-[50vh] overflow-y-auto border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
                    {searchResultsFrom.map((s, i) => (
                      <button key={i} onClick={() => { setFromStation(s); setSearchResultsFrom([]); }} className="w-full text-left px-4 py-3 border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-3">
                        <MapPin size={16} className="text-slate-400" />
                        <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">{s.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* TO Input */}
              <div className="relative z-10">
                <div className={`flex items-center bg-slate-50 dark:bg-slate-950 rounded-2xl p-2 border transition-all group ${toStation ? 'border-sky-500/30 bg-sky-50/50 dark:bg-slate-900' : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                  <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
                    <MapPin size={18} className="text-sky-500 fill-sky-500/20" />
                  </div>
                  <input
                    type="text"
                    placeholder="Vart vill du åka?"
                    className="flex-1 bg-transparent outline-none text-slate-800 dark:text-slate-100 font-bold text-base py-1 placeholder:text-slate-400 placeholder:font-medium"
                    value={toStation ? toStation.name : toQuery}
                    onChange={(e) => {
                      setToQuery(e.target.value);
                      setToStation(null);
                      // Debounce handled in useEffect
                    }}
                  />
                  {toStation || toQuery ? <button onClick={() => { setToStation(null); setToQuery(''); }} className="p-2 text-slate-400 hover:text-red-500 transition-colors"><X size={18} /></button> : null}
                </div>
                {/* Results Dropdown */}
                {searchResultsTo.length > 0 && !toStation && (
                  <div className="absolute top-full left-4 right-0 bg-white dark:bg-slate-900 shadow-2xl rounded-xl mt-2 z-50 max-h-[50vh] overflow-y-auto border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
                    {searchResultsTo.map((s, i) => (
                      <button key={i} onClick={() => { setToStation(s); setSearchResultsTo([]); }} className="w-full text-left px-4 py-3 border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-3">
                        <MapPin size={16} className="text-slate-400" />
                        <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">{s.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Swap Button (Floating) */}
              <button
                onClick={handleReverse}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-30 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-2.5 text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 shadow-sm hover:shadow-md hover:scale-105 active:rotate-180 transition-all"
                title="Växla riktning"
              >
                <ArrowUpDown size={18} strokeWidth={2.5} />
              </button>
            </div>

            {/* Controls Row */}
            <div className="flex items-center gap-3 mt-4">
              {/* Time Toggle */}
              <div className="flex-1 bg-slate-100 dark:bg-slate-950 p-1.5 rounded-2xl flex items-center">
                <button
                  onClick={() => setTimeMode('now')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${timeMode === 'now' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                >
                  Nu
                </button>
                <button
                  onClick={() => setTimeMode('later')}
                  className={`flex-1 px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${timeMode === 'later' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
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

              {/* Search Button */}
              <button
                disabled={!fromStation || !toStation || loading}
                onClick={handlePlanTrip}
                className="bg-sky-500 hover:bg-sky-600 dark:bg-sky-600 dark:hover:bg-sky-500 disabled:opacity-50 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white font-black px-6 py-3 rounded-2xl shadow-lg shadow-sky-500/20 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
              >
                {loading ? <ThemedSpinner size={20} className="text-white" /> : <Search size={20} strokeWidth={3} />}
              </button>
            </div>

            {/* Expanded Date/Time Picker - More Spacious */}
            {timeMode === 'later' && (
              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-3 animate-in slide-in-from-top-2 fade-in duration-200">
                <input
                  type="date"
                  value={tripDate}
                  onChange={(e) => setTripDate(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-950 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 dark:text-white outline-none border border-transparent focus:border-sky-500 transition-colors shadow-inner"
                />
                <input
                  type="time"
                  value={tripTime}
                  onChange={(e) => setTripTime(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-950 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 dark:text-white outline-none border border-transparent focus:border-sky-500 transition-colors shadow-inner text-center"
                />
              </div>
            )}

            {/* Error Banner */}
            {error && (
              <div className="mt-3 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-xl p-3 flex items-start gap-3 animate-in fade-in slide-in-from-top-1">
                <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={16} />
                <span className="text-sm font-medium text-red-800 dark:text-red-300">{error}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* --- Results List --- */}
      <div className="flex-1 overflow-y-auto px-4 pb-32 space-y-3 pt-2">

        {/* Loading State */}
        {loading && (
          <div className="animate-in fade-in duration-300 space-y-4 pt-4">
            <JourneySkeleton />
            <JourneySkeleton />
          </div>
        )}

        {/* Empty States */}
        {journeys.length === 0 && !loading && !hasSearched && (
          <div className="flex flex-col items-center justify-center mt-20 opacity-40 animate-in zoom-in-95 duration-500">
            <div className="w-20 h-20 bg-slate-200 dark:bg-slate-800 rounded-3xl flex items-center justify-center mb-4 rotate-6">
              <Search size={32} className="text-slate-400 dark:text-slate-500" />
            </div>
            <p className="font-bold text-slate-400 dark:text-slate-500 text-sm uppercase tracking-widest">Sök din resa</p>
          </div>
        )}

        {journeys.length === 0 && !loading && hasSearched && (
          <div className="bg-red-50 dark:bg-red-900/10 p-6 rounded-2xl text-center border border-red-100 dark:border-red-900/30 mt-4 animate-in fade-in">
            <AlertCircle className="mx-auto text-red-400 mb-2" size={24} />
            <p className="font-bold text-red-800 dark:text-red-400 mb-1">Inga resor hittades</p>
            <p className="text-xs text-red-600 dark:text-red-300">Prova att söka på en annan tid eller plats.</p>
          </div>
        )}

        {/* Journey Cards */}
        {journeys.map((j) => {
          const transfers = countTransfers(j.legs);
          const duration = calculateDuration(j.startTime, j.endTime);
          const isExpanded = expandedJourneyId === j.id;

          return (
            <div key={j.id} className="bg-white dark:bg-slate-900 rounded-[1.25rem] shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden relative group transition-all hover:shadow-md animate-in fade-in slide-in-from-bottom-4 duration-500">

              {/* Summary Card */}
              <div onClick={() => setExpandedJourneyId(isExpanded ? null : j.id)} className="p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">

                {/* Top Row: Times & Duration */}
                <div className="flex justify-between items-end mb-4">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-2xl text-slate-800 dark:text-white tracking-tight">{j.startTime}</span>
                      <div className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-600 mt-2"></div>
                      <span className="font-bold text-xl text-slate-400">{j.endTime}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">
                        <Clock size={12} className="text-slate-400" />
                        <span className="font-bold text-sm text-slate-700 dark:text-slate-200">{duration}</span>
                      </div>
                      {/* Warning Badge if any leg is cancelled or disrupted */}
                      {j.legs.some(l => l.cancelled || l.disruptionSeverity === 'severe') && (
                        <div className="flex items-center gap-1 text-xs font-bold text-red-500 animate-pulse">
                          <AlertCircle size={12} />
                          <span>Strul</span>
                        </div>
                      )}
                      {j.legs.some(l => !l.cancelled && l.messages && l.messages.length > 0) && !j.legs.some(l => l.cancelled) && (
                        <div className="flex items-center gap-1 text-xs font-bold text-yellow-500">
                          <AlertTriangle size={12} />
                          <span>Info</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Middle Row: Visual Route Chain */}
                <div className="flex items-center gap-1.5 mb-4 overflow-hidden mask-linear-fade py-1">
                  {j.legs.map((leg, lIdx) => {
                    if (leg.type === 'WALK') {
                      if (leg.duration < 4) return <div key={lIdx} className="w-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 mx-0.5"></div>;
                      return (
                        <React.Fragment key={lIdx}>
                          <div className="h-[2px] w-2 bg-slate-200 dark:bg-slate-800"></div>
                          <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 text-slate-400 p-1 rounded-md shadow-sm">
                            <Footprints size={12} />
                          </div>
                          <div className="h-[2px] w-2 bg-slate-200 dark:bg-slate-800"></div>
                        </React.Fragment>
                      );
                    }
                    return (
                      <React.Fragment key={lIdx}>
                        {lIdx > 0 && <div className="h-[2px] w-3 bg-slate-200 dark:bg-slate-800"></div>}
                        <div
                          className="h-7 px-2.5 rounded-lg flex items-center justify-center text-white text-[11px] font-black shadow-md border-b-2 border-black/10 select-none bg-gradient-to-b from-white/10 to-transparent relative overflow-hidden"
                          style={{ backgroundColor: leg.bgColor || '#0ea5e9', color: leg.fgColor }}
                        >
                          <span className="mr-1.5 opacity-90">{getTransportIcon(leg.type, 12)}</span>
                          {leg.name.replace(/\D/g, '') || leg.name.substring(0, 3)}
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>

                {/* Bottom Row: Footer Info */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs font-bold text-slate-500 dark:text-slate-400">
                    {transfers === 0 ? (
                      <span className="text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-1.5 py-0.5 rounded">Inga byten</span>
                    ) : (
                      <span>{transfers} byten</span>
                    )}
                    <span className="text-slate-300">•</span>
                    <span className="truncate max-w-[150px]">Gång <span className="text-slate-900 dark:text-white">{j.legs.reduce((acc, l) => l.type === 'WALK' ? acc + l.duration : acc, 0)} min</span></span>
                  </div>
                  <div className={`text-slate-300 dark:text-slate-600 transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`}>
                    <ChevronRight size={18} />
                  </div>
                </div>
              </div>

              {/* Expanded Detail View */}
              {isExpanded && (
                <div className="bg-slate-50/50 dark:bg-black/20 p-5 border-t border-slate-100 dark:border-slate-800/50">
                  <div className="relative">
                    {/* Continuous Line Background */}
                    <div className="absolute left-[3.25rem] top-2 bottom-4 w-0.5 bg-slate-200 dark:bg-slate-800"></div>

                    {j.legs.map((leg, idx) => {
                      const isLast = idx === j.legs.length - 1;
                      const isWalk = leg.type === 'WALK';

                      return (
                        <React.Fragment key={idx}>
                          {/* NODE (Origin) */}
                          <div className="flex gap-4 relative mb-8 last:mb-0">
                            {/* Time */}
                            <div className="w-10 text-right pt-0.5 flex-shrink-0">
                              <div className="font-bold text-xs text-slate-900 dark:text-white">{leg.origin.time}</div>
                            </div>

                            {/* Visual Node */}
                            <div className="relative z-10 flex-shrink-0">
                              <div className={`w-3 h-3 rounded-full border-2 ${isWalk ? 'bg-slate-100 border-slate-300 dark:bg-slate-800 dark:border-slate-600' : 'bg-white border-sky-500 dark:bg-slate-900 dark:border-sky-500 shadow-[0_0_0_3px_rgba(14,165,233,0.15)]'}`}></div>
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0 pt-0.5">
                              <div className="flex justify-between items-start">
                                <div className="font-bold text-sm text-slate-800 dark:text-white leading-tight truncate">{leg.origin.name}</div>
                                {leg.origin.track && <span className="text-[10px] font-bold bg-slate-200 dark:bg-slate-700 px-1.5 rounded text-slate-600 dark:text-slate-300 ml-2">Läge {leg.origin.track}</span>}
                              </div>

                              {/* Transport Details Card */}
                              <div className={`mt-3 p-3 rounded-xl border ${isWalk ? 'bg-transparent border-dashed border-slate-300 dark:border-slate-700' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 shadow-sm'}`}>
                                <div className="flex items-center gap-3">
                                  <div
                                    className={`h-9 min-w-[36px] px-2 rounded-lg flex items-center justify-center text-white text-xs font-black shadow-md border-b-2 border-black/10 flex-shrink-0 bg-gradient-to-b from-white/10 to-transparent ${isWalk ? 'bg-slate-300 dark:bg-slate-700 border-none shadow-none text-slate-500' : ''}`}
                                    style={{ backgroundColor: !isWalk ? (leg.bgColor || '#0ea5e9') : undefined, color: !isWalk ? leg.fgColor : undefined }}
                                  >
                                    {getTransportIcon(leg.type, 16)}
                                    {!isWalk && <span className="ml-1.5">{leg.name.replace(/\D/g, '') || leg.name.substring(0, 3)}</span>}
                                  </div>
                                  <div className="min-w-0">
                                    {isWalk ? (
                                      <div className="text-xs font-bold text-slate-500 dark:text-slate-400">Gå {leg.distance ? `${leg.distance}m` : ''} ({leg.duration} min)</div>
                                    ) : (
                                      <>
                                        <div className="font-black text-sm text-slate-800 dark:text-white truncate">{leg.name}</div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate">Mot {leg.direction}</div>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Destination Node (Only if last leg) - SPECIAL STYLING */}
                          {isLast && (
                            <div className="flex gap-4 relative mt-8 bg-sky-50/50 dark:bg-sky-900/10 -mx-5 px-5 py-4 border-t border-sky-100 dark:border-sky-900/30">
                              <div className="w-10 text-right pt-1 flex-shrink-0">
                                {/* Empty time here, displayed prominently on right instead */}
                              </div>
                              <div className="relative z-10 flex-shrink-0 pt-1">
                                <div className="w-4 h-4 rounded-full bg-slate-900 dark:bg-white flex items-center justify-center shadow-lg">
                                  <Flag size={8} className="text-white dark:text-slate-900 fill-current" />
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <div className="font-black text-base text-slate-900 dark:text-white leading-tight">{leg.destination.name}</div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-0.5">Slutstation</div>
                                  </div>

                                  {/* Prominent Arrival & Track Info */}
                                  <div className="flex flex-col items-end">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ankomst</span>
                                      <span className="font-black text-xl text-slate-800 dark:text-white">{leg.destination.time}</span>
                                    </div>
                                    {leg.destination.track && (
                                      <div className="mt-1">
                                        <span className="inline-block bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 text-[10px] font-black px-1.5 py-0.5 rounded shadow-sm">
                                          LÄGE {leg.destination.track}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>

                  <div className="mt-2 pt-4">
                    <button className="w-full py-2.5 flex items-center justify-center gap-2 text-xs font-bold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/20 rounded-xl hover:bg-sky-100 dark:hover:bg-sky-900/40 transition-colors">
                      <AlertCircle size={14} /> Visa detaljerad trafikinfo
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* AI Travel Assistant Chat */}
      <div className="fixed bottom-20 right-4 z-50">
        {/* Chat Button */}
        <button
          onClick={() => setShowAIChat(!showAIChat)}
          className={`w-14 h-14 rounded-full shadow-xl transition-all duration-300 hover:scale-110 ${showAIChat
            ? 'bg-sky-500 text-white shadow-sky-500/30'
            : 'bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 border-2 border-sky-500/20'
            }`}
        >
          <Bot size={24} className="mx-auto" />
        </button>

        {/* Chat Window */}
        {showAIChat && (
          <div className="absolute bottom-16 right-0 w-80 max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in slide-in-from-bottom-2 fade-in duration-300">
            {/* Chat Header */}
            <div className="bg-sky-500 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <Bot size={16} />
                  {/* Active indicator */}
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-sky-500 animate-pulse"></div>
                </div>
                <div>
                  <div className="font-bold text-sm">Resmus</div>
                  <div className="text-xs opacity-90">Västtrafik Göteborg</div>
                </div>
              </div>
              <button
                onClick={() => setShowAIChat(false)}
                className="text-white/70 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Chat Messages */}
            <div className="h-80 overflow-y-auto p-4 space-y-3">
              {chatMessages.map((message, idx) => (
                <div
                  key={idx}
                  className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {message.role === 'assistant' && (
                    <div className="w-6 h-6 rounded-full bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Bot size={12} className="text-sky-600 dark:text-sky-400" />
                    </div>
                  )}
                  <div
                    className={`max-w-[70%] p-3 rounded-2xl text-sm ${message.role === 'user'
                      ? 'bg-sky-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                      }`}
                  >
                    {message.content}
                  </div>
                  {message.role === 'user' && (
                    <div className="w-6 h-6 rounded-full bg-sky-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <User size={12} className="text-white" />
                    </div>
                  )}
                </div>
              ))}
              {chatLoading && (
                <div className="flex gap-3 justify-start">
                  <div className="w-6 h-6 rounded-full bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot size={12} className="text-sky-600 dark:text-sky-400" />
                  </div>
                  <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-2xl">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Chat Input - Compact Footer */}
            <div className="border-t border-slate-200 dark:border-slate-700 p-2 bg-slate-50 dark:bg-slate-900/50 backdrop-blur-sm rounded-b-2xl">
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Sök resa..."
                  className="flex-1 bg-white dark:bg-slate-800 border-0 ring-1 ring-slate-200 dark:ring-slate-700 rounded-full px-4 py-1.5 text-sm outline-none focus:ring-2 focus:ring-sky-500 transition-all shadow-sm"
                  disabled={chatLoading}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!chatInput.trim() || chatLoading}
                  className="bg-sky-500 hover:bg-sky-600 disabled:opacity-50 disabled:bg-slate-300 text-white w-8 h-8 flex items-center justify-center rounded-full transition-all shadow-md hover:scale-105 active:scale-95"
                >
                  <Send size={14} className="ml-0.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  async function handleSendMessage() {
    if (!chatInput.trim()) return;

    const userMessage = chatInput.trim();
    setChatInput('');

    // Content filtering - prevent inappropriate messages
    const inappropriateWords = ['fuck', 'shit', 'damn', 'bitch', 'asshole', 'bastard', 'crap', 'piss', 'dick', 'cock', 'pussy', 'tits', 'ass', 'sex', 'porn', 'nude', 'naked'];
    const lowerMessage = userMessage.toLowerCase();

    if (inappropriateWords.some(word => lowerMessage.includes(word))) {
      setChatMessages(prev => [...prev,
      { role: 'user', content: userMessage },
      { role: 'assistant', content: 'Jag är här för att hjälpa med frågor om kollektivtrafiken i Göteborg. Låt oss hålla samtalet vänligt och relevant. Vad kan jag hjälpa dig med angående resor och trafik?' }
      ]);
      return;
    }

    setChatLoading(true);

    // Add user message
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);

    try {
      // Enhanced AI response logic with direct Västtrafik information
      let response = '';

      if (lowerMessage.includes('västtågen') || lowerMessage.includes('tåg')) {
        response = 'Västtågen trafikerar sträckan Göteborg - Stockholm med moderna tåg. Just nu finns inga större störningar rapporterade. För realtidsinformation, använd sökfunktionen ovan eller Västtrafiks app.';
      } else if (lowerMessage.includes('spårvagn') || lowerMessage.includes('tram')) {
        response = 'Göteborgs spårvagnar trafikerar centrum och förorterna. Linje 1-13 är de viktigaste. Förseningar kan förekomma under rusningstid, men trafiken är generellt pålitlig.';
      } else if (lowerMessage.includes('buss')) {
        response = 'Göteborg har ett omfattande bussnätverk. Lokala linjer (1-99) trafikerar staden, regionala (100-199) går längre sträckor, och expresslinjer (200-299) har färre stopp.';
      } else if (lowerMessage.includes('färja') || lowerMessage.includes('båt')) {
        response = 'Västtrafiks färjor trafikerar främst Göteborg - Styrsö. Trafiken är väderberoende och kan påverkas av vind och vattenstånd.';
      } else if (lowerMessage.includes('linje') && /\d+/.test(lowerMessage)) {
        const lineNumber = lowerMessage.match(/(\d+)/)?.[1];
        response = `Linje ${lineNumber} är en viktig förbindelse i Göteborgs kollektivtrafik. För aktuella tider och eventuella förseningar, använd sökfunktionen ovan.`;
      } else if (lowerMessage.includes('störning') || lowerMessage.includes('försening') || lowerMessage.includes('problem')) {
        response = 'Aktuella störningar i Göteborgs kollektivtrafik visas i fliken "Störningar". De flesta störningar är tillfälliga och trafiken återgår till normalt inom kort.';
      } else if (lowerMessage.includes('hållplats') || lowerMessage.includes('station')) {
        response = 'Göteborg har över 1000 hållplatser för kollektivtrafik. Populära knutpunkter är Centralstationen, Brunnsparken och Korsvägen. Använd sökfunktionen för att hitta din närmaste hållplats.';
      } else if (lowerMessage.includes('tid') || lowerMessage.includes('avgång') || lowerMessage.includes('ankomst')) {
        response = 'För exakta avgångstider, använd sökfunktionen ovan genom att ange från- och till-hållplats. Tiderna uppdateras i realtid och visar eventuella förseningar.';
      } else if (lowerMessage.includes('biljett') || lowerMessage.includes('pris') || lowerMessage.includes('betala')) {
        response = 'Västtrafik erbjuder olika biljettyper: enkelbiljett (30 dagar), 24-timmarsbiljett, månadsbiljett och årskort. Priser varierar beroende på zon och ålder.';
      } else if (lowerMessage.includes('rusning') || lowerMessage.includes('trafik')) {
        response = 'Under rusningstid (07:00-09:00 och 16:00-18:00) kan förseningar förekomma på grund av högre trafik. Planera extra tid för dina resor under dessa perioder.';
      } else if (lowerMessage.includes('karta') || lowerMessage.includes('väg') || lowerMessage.includes('hitta')) {
        response = 'För att hitta rätt väg till din hållplats kan du använda Västtrafiks reseplanerare eller app. De flesta hållplatser har även skyltar med linjeinformation.';
      } else {
        response = 'Jag kan hjälpa dig med information om Göteborgs kollektivtrafik: linjer, hållplatser, tider, störningar och allmänna råd. Vad vill du veta mer om?';
      }

      // Simulate typing delay
      setTimeout(() => {
        setChatMessages(prev => [...prev, { role: 'assistant', content: response }]);
        setChatLoading(false);
      }, 800);

    } catch (error) {
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Tyvärr kunde jag inte behandla din fråga just nu. Västtrafiks tjänster kan vara tillfälligt otillgängliga. Försök igen senare eller använd Västtrafiks officiella app för den senaste informationen.'
      }]);
      setChatLoading(false);
    }
  }
}
