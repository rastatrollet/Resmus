
import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faClock, faMapPin, faSpinner, faExclamationCircle, faBus, faTram, faShip, faWalking, faArrowRightArrowLeft, faChevronDown, faTimes, faArrowRight, faArrowDown, faCalendarAlt, faChevronRight, faFlag, faComment, faPaperPlane, faRobot, faUser, faLocationArrow, faExclamationTriangle, faWifi } from '@fortawesome/free-solid-svg-icons';
import { TransitService } from '../services/transitService';
import { Station, Journey, TripLeg, Provider } from '../types';
import { JourneySkeleton, ThemedSpinner } from './Loaders';

export const TripPlanner: React.FC = () => {
  const [fromQuery, setFromQuery] = useState('');
  const [toQuery, setToQuery] = useState('');
  const [fromStation, setFromStation] = useState<Station | null>(null);
  const [toStation, setToStation] = useState<Station | null>(null);
  const [provider, setProvider] = useState<Provider>(Provider.RESROBOT);

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
    let icon = faBus;
    if (t.includes('TRAM')) icon = faTram;
    else if (t.includes('FERRY') || t.includes('BOAT')) icon = faShip;
    else if (t === 'WALK') icon = faWalking;

    return <FontAwesomeIcon icon={icon} style={{ fontSize: size }} />;
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

          <div className="p-5 pb-4">
            <h1 className="text-2xl font-black text-slate-800 dark:text-white mb-6 tracking-tight">Vart vill du åka?</h1>

            <div className="relative">
              {/* Visual Connector Line */}
              <div className="absolute left-[1.15rem] top-10 bottom-10 w-[2px] bg-gradient-to-b from-slate-200 via-slate-300 to-sky-500 dark:from-slate-700 dark:to-sky-900 rounded-full"></div>

              {/* FROM Input */}
              <div className="relative z-20 mb-4">
                <div className={`flex items-center bg-slate-50 dark:bg-slate-950 rounded-2xl p-3 border-2 transition-all group shadow-sm ${fromStation ? 'border-sky-500/20 bg-sky-50/30' : 'border-transparent hover:border-slate-200 dark:hover:border-slate-700'}`}>
                  <div className="w-10 h-10 flex items-center justify-center flex-shrink-0 mr-1">
                    <div className="w-3.5 h-3.5 border-[3.5px] border-slate-400 dark:border-slate-500 rounded-full bg-white dark:bg-slate-900 shadow-sm ring-2 ring-white dark:ring-slate-900"></div>
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-0.5 block">Från</label>
                    <input
                      type="text"
                      placeholder="Nuvarande plats"
                      className="w-full bg-transparent outline-none text-slate-800 dark:text-white font-bold text-lg placeholder:text-slate-300 dark:placeholder:text-slate-600"
                      value={fromStation ? fromStation.name : fromQuery}
                      onChange={(e) => {
                        setFromQuery(e.target.value);
                        setFromStation(null);
                      }}
                    />
                  </div>
                  {/* Location Button or Clear Button */}
                  {fromStation || fromQuery ? (
                    <button onClick={() => { setFromStation(null); setFromQuery(''); }} className="p-2 text-slate-300 hover:text-slate-500 transition-colors"><FontAwesomeIcon icon={faTimes} /></button>
                  ) : (
                    <button
                      onClick={handleUseMyLocation}
                      disabled={gettingLocation}
                      className="p-2 text-sky-500 hover:text-sky-600 transition-colors disabled:opacity-50"
                      title="Använd min plats"
                    >
                      {gettingLocation ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faLocationArrow} />}
                    </button>
                  )}
                </div>
                {/* Results Dropdown */}
                {searchResultsFrom.length > 0 && !fromStation && (
                  <div className="absolute top-full left-4 right-0 bg-white dark:bg-slate-900 shadow-2xl rounded-2xl mt-2 z-50 max-h-[50vh] overflow-y-auto border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200 p-2">
                    {searchResultsFrom.map((s, i) => (
                      <button key={i} onClick={() => { setFromStation(s); setSearchResultsFrom([]); }} className="w-full text-left px-4 py-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-3 group">
                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-sky-100 dark:group-hover:bg-sky-900/30 transition-colors">
                          <FontAwesomeIcon icon={faMapPin} className="text-slate-400 group-hover:text-sky-500 text-sm" />
                        </div>
                        <div>
                          <span className="font-bold text-slate-800 dark:text-slate-200 block text-sm">{s.name}</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase">{s.provider === 'SL' ? 'Stockholm' : 'Västtrafik'}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* TO Input */}
              <div className="relative z-10">
                <div className={`flex items-center bg-slate-50 dark:bg-slate-950 rounded-2xl p-3 border-2 transition-all group shadow-sm ${toStation ? 'border-sky-500/20 bg-sky-50/30' : 'border-transparent hover:border-slate-200 dark:hover:border-slate-700'}`}>
                  <div className="w-10 h-10 flex items-center justify-center flex-shrink-0 mr-1">
                    <FontAwesomeIcon icon={faMapPin} className="text-sky-500 text-xl drop-shadow-sm" />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-0.5 block">Till</label>
                    <input
                      type="text"
                      placeholder="Vart ska du?"
                      className="w-full bg-transparent outline-none text-slate-800 dark:text-white font-bold text-lg placeholder:text-slate-300 dark:placeholder:text-slate-600"
                      value={toStation ? toStation.name : toQuery}
                      onChange={(e) => {
                        setToQuery(e.target.value);
                        setToStation(null);
                      }}
                    />
                  </div>
                  {toStation || toQuery ? <button onClick={() => { setToStation(null); setToQuery(''); }} className="p-2 text-slate-300 hover:text-slate-500 transition-colors"><FontAwesomeIcon icon={faTimes} /></button> : null}
                </div>
                {/* Results Dropdown */}
                {searchResultsTo.length > 0 && !toStation && (
                  <div className="absolute top-full left-4 right-0 bg-white dark:bg-slate-900 shadow-2xl rounded-2xl mt-2 z-50 max-h-[50vh] overflow-y-auto border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200 p-2">
                    {searchResultsTo.map((s, i) => (
                      <button key={i} onClick={() => { setToStation(s); setSearchResultsTo([]); }} className="w-full text-left px-4 py-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-3 group">
                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-sky-100 dark:group-hover:bg-sky-900/30 transition-colors">
                          <FontAwesomeIcon icon={faMapPin} className="text-slate-400 group-hover:text-sky-500 text-sm" />
                        </div>
                        <div>
                          <span className="font-bold text-slate-800 dark:text-slate-200 block text-sm">{s.name}</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase">{s.provider === 'SL' ? 'Stockholm' : 'Västtrafik'}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Swap Button (Floating) */}
              <button
                onClick={handleReverse}
                className="absolute right-6 top-1/2 -translate-y-1/2 z-30 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-full p-2.5 text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 shadow-lg hover:shadow-xl hover:scale-105 active:rotate-180 transition-all"
                title="Växla riktning"
              >
                <FontAwesomeIcon icon={faArrowRightArrowLeft} className="rotate-90 text-sm" />
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
                      <FontAwesomeIcon icon={faCalendarAlt} />
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
                {loading ? <ThemedSpinner size={20} className="text-white" /> : <FontAwesomeIcon icon={faSearch} className="text-lg" />}
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
                <FontAwesomeIcon icon={faExclamationTriangle} className="text-red-500 shrink-0 mt-0.5" />
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
              <FontAwesomeIcon icon={faSearch} className="text-slate-400 dark:text-slate-500 text-3xl" />
            </div>
            <p className="font-bold text-slate-400 dark:text-slate-500 text-sm uppercase tracking-widest">Sök din resa</p>
          </div>
        )}

        {journeys.length === 0 && !loading && hasSearched && (
          <div className="bg-red-50 dark:bg-red-900/10 p-6 rounded-2xl text-center border border-red-100 dark:border-red-900/30 mt-4 animate-in fade-in">
            <FontAwesomeIcon icon={faExclamationCircle} className="mx-auto text-red-400 mb-2 text-2xl" />
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
                        <FontAwesomeIcon icon={faClock} className="text-slate-400 text-xs" />
                        <span className="font-bold text-sm text-slate-700 dark:text-slate-200">{duration}</span>
                      </div>
                      {/* Warning Badge if any leg is cancelled or disrupted */}
                      {j.legs.some(l => l.cancelled || l.disruptionSeverity === 'severe') && (
                        <div className="flex items-center gap-1 text-xs font-bold text-red-500 animate-pulse">
                          <FontAwesomeIcon icon={faExclamationCircle} />
                          <span>Strul</span>
                        </div>
                      )}
                      {j.legs.some(l => !l.cancelled && l.messages && l.messages.length > 0) && !j.legs.some(l => l.cancelled) && (
                        <div className="flex items-center gap-1 text-xs font-bold text-yellow-500">
                          <FontAwesomeIcon icon={faExclamationTriangle} />
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
                            <FontAwesomeIcon icon={faWalking} className="text-[10px]" />
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
                    <FontAwesomeIcon icon={faChevronRight} />
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
                                  <FontAwesomeIcon icon={faFlag} className="text-white dark:text-slate-900 text-[8px]" />
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
                      <FontAwesomeIcon icon={faExclamationCircle} /> Visa detaljerad trafikinfo
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>


    </div >
  );

};
