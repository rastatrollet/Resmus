import React, { useState, useEffect } from 'react';
import { Departure, Provider, Station, StopOnTrip, JourneyDetail } from '../types';
import { TransitService } from '../services/transitService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faMapPin, faArrowUp, faArrowDown, faChevronUp, faExclamationCircle, faExclamationTriangle, faArrowsAltV, faCalendarAlt, faTimes, faBus, faLocationArrow, faTram, faShip, faBan, faStar, faTrash, faWalking, faTaxi, faFilter, faChevronLeft, faChevronRight, faInfoCircle, faClock, faGlobe } from '@fortawesome/free-solid-svg-icons';
import { DepartureSkeleton, ThemedSpinner } from './Loaders';

import { WeatherDisplay } from './WeatherDisplay';
import { DepartureRouteMap } from './DepartureRouteMap';
import { useAlarms } from '../hooks/useAlarms';
import { TripPlanner } from './TripPlanner';

interface DeparturesBoardProps {
  initialStation?: Station;
  mode?: 'departures' | 'arrivals';
}

// Custom Information Icon (Inline SVG for reliability)
// Custom Information Icon (Modern & Clean)
const DisruptionInfoIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className="w-4 h-4 text-sky-500 flex-shrink-0"
    aria-label="Trafikstörning"
  >
    <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 0 1 .67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 0 1-.671-1.34l.041-.022ZM12 9a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
  </svg>
);

import { useToast } from './ToastProvider';

export const DeparturesBoard: React.FC<DeparturesBoardProps> = ({ initialStation, mode = 'departures' }) => {
  const { addAlarm, alarms } = useAlarms();
  const toast = useToast();
  // View Mode State (Station vs Trip Planner)
  const [rootView, setRootView] = useState<'station' | 'planner'>('station');

  // Search & Station State
  const [query, setQuery] = useState('');
  const [station, setStation] = useState<Station | null>(initialStation || null);
  const [provider, setProvider] = useState<Provider>(() => {
    return (localStorage.getItem('resmus_default_provider') as Provider) || Provider.VASTTRAFIK;
  });
  const [departures, setDepartures] = useState<Departure[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<Station[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [viewMode, setViewMode] = useState<'departures' | 'arrivals'>(mode);
  const [sortMode, setSortMode] = useState<'time' | 'line'>('time');
  const [timeDisplayMode, setTimeDisplayMode] = useState<'minutes' | 'clock'>('clock');


  const [customTime, setCustomTime] = useState<string>(''); // YYYY-MM-DDTHH:MM
  const [timeWindow, setTimeWindow] = useState(480); // Default 8 hours

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Favorites State
  const [favorites, setFavorites] = useState<Station[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('resmus_favorites');
    if (saved) {
      try {
        setFavorites(JSON.parse(saved));
      } catch (e) { console.error("Failed to load favorites"); }
    }

    // Check if we navigated from favorites
    const selectedFavorite = localStorage.getItem('resmus_selected_favorite');
    if (selectedFavorite) {
      try {
        const station = JSON.parse(selectedFavorite);
        setStation(station);
        localStorage.removeItem('resmus_selected_favorite'); // Clean up
      } catch (e) {
        console.error("Failed to parse selected favorite");
      }
    }
  }, []);

  const toggleFavorite = (s: Station) => {
    const isFav = favorites.some(f => f.id === s.id);
    let newFavs;
    if (isFav) {
      newFavs = favorites.filter(f => f.id !== s.id);
    } else {
      newFavs = [...favorites, s];
    }
    setFavorites(newFavs);
    localStorage.setItem('resmus_favorites', JSON.stringify(newFavs));
  };

  const isStationFavorite = (s: Station | null) => {
    if (!s) return false;
    return favorites.some(f => f.id === s.id);
  };

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.length > 2) {
        setIsSearching(true);
        const results = await TransitService.searchStations(query, provider);
        setSearchResults(results);
        setIsSearching(false);
      } else {
        setSearchResults([]);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [query, provider]);

  const fetchData = async (silent = false) => {
    if (station) {
      if (!silent) setLoading(true);

      try {
        // Ensure time string is complete if exists
        const timeParam = customTime ? customTime : undefined;

        let data = await TransitService.getDepartures(station.id, station.provider, viewMode, timeParam, timeWindow);

        // FILLER LOGIC: If we have few departures, fetch more from the future
        if (data.length > 0 && data.length < 10 && !customTime) {
          // console.log(`Only ${data.length} departures found, fetching more...`);
          const lastDep = data[data.length - 1];
          if (lastDep.timestamp) {
            // Fetch starting from 1 minute after the last departure
            const nextTime = new Date(new Date(lastDep.timestamp).getTime() + 60000).toISOString();
            const additionalData = await TransitService.getDepartures(station.id, station.provider, viewMode, nextTime, timeWindow);

            // Filter out duplicates (though Västtrafik GIDs should be unique)
            const seenIds = new Set(data.map(d => d.id));
            const uniqueAdditional = additionalData.filter(d => !seenIds.has(d.id));

            data = [...data, ...uniqueAdditional];
            // console.log(`Added ${uniqueAdditional.length} more departures.`);
          }
        }

        // If still less than 2 departures and no custom time, try next day
        if (data.length < 2 && !customTime) {
          // console.log(`Only ${data.length} departures found, trying next day...`);
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          tomorrow.setHours(6, 0, 0, 0); // Start from 6 AM next day

          const nextDayTime = tomorrow.toISOString();
          const nextDayData = await TransitService.getDepartures(station.id, station.provider, viewMode, nextDayTime);

          // Filter out duplicates
          const seenIds = new Set(data.map(d => d.id));
          const uniqueNextDay = nextDayData.filter(d => !seenIds.has(d.id));

          data = [...data, ...uniqueNextDay.slice(0, 10)]; // Add up to 10 from next day
          // console.log(`Added ${uniqueNextDay.length} departures from next day.`);
        }

        setDepartures(data);
      } catch (err) {
        setDepartures([]);
        setError("Kunde inte hämta avgångar. Kontrollera din internetanslutning och försök igen.");
        // Silent error log
      } finally {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchData(false);
    const intervalId = setInterval(() => { fetchData(true); }, 60000);
    return () => clearInterval(intervalId);
  }, [station, viewMode, customTime]);

  const handleUseLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Geolokalisering stöds inte.");
      return;
    }
    setIsSearching(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      const stations = await TransitService.getNearbyStations(latitude, longitude);
      setSearchResults(stations);
      setIsSearching(false);
    }, (err) => {
      console.error(err);
      setLocationError("Kunde inte hämta position.");
      setIsSearching(false);
    });
  };

  // Filter out departures way in the past if using "now"
  // If custom time is set, we trust API to return correct window
  const filteredDepartures = departures.filter(dep => {
    if (!dep.timestamp) return false;

    // If no custom time, filter out old departures (>10 min ago)
    if (!customTime) {
      const depTime = new Date(dep.timestamp).getTime();
      const now = Date.now();
      if (depTime < now - (10 * 60 * 1000)) return false;
    }
    return true;
  });

  const sortedDepartures = [...filteredDepartures]
    .sort((a, b) => {
      if (sortMode === 'time') {
        if (a.timestamp && b.timestamp) {
          return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
        }
        return a.time.localeCompare(b.time);
      }
      return a.line.localeCompare(b.line, undefined, { numeric: true, sensitivity: 'base' });
    });

  const toggleSort = () => setSortMode(prev => prev === 'time' ? 'line' : 'time');

  const handleSelectStation = (s: Station) => {
    setStation(s);
    setQuery('');
    setSearchResults([]);
    setDepartures([]);
  };

  const getTransportIcon = (type: string | undefined, size = 16) => {
    const t = (type || '').toUpperCase();

    // Tram / Spårvagn
    if (t.includes('TRAM') || t.includes('SPÅRVAGN') || t.includes('SPARVAGN')) return <FontAwesomeIcon icon={faTram} className={`text-[${size}px]`} />;

    // Boat / Ferry / Båt / Färja
    if (t.includes('FERRY') || t.includes('BOAT') || t.includes('BÅT') || t.includes('BAT') || t.includes('FÄRJA') || t.includes('FARJA') || t.includes('ÄLVSNABBEN')) return <FontAwesomeIcon icon={faShip} className={`text-[${size}px]`} />;

    // Walk / Gå
    if (t === 'WALK' || t.includes('GÅ')) return <FontAwesomeIcon icon={faWalking} className={`text-[${size}px]`} />;

    // Default / Bus (Returns null to hide icon as requested, unless logic changes)
    return null;
  };

  const getDefaultLineColor = (type: string | undefined, line: string) => {
    const t = (type || '').toUpperCase();
    const lineNum = parseInt(line) || 0;

    // Train / Tåg - Dark blue (better contrast)
    if (t.includes('TRAIN') || t.includes('TÅG') || t.includes('TAG') || t.includes('KUSTPILEN') || t.includes('ÖRESUNDSTÅG') || t.includes('VÄSTTÅGEN')) {
      return '#1e40af'; // Dark blue instead of light blue
    }

    // Tram / Spårvagn - Dark green
    if (t.includes('TRAM') || t.includes('SPÅRVAGN') || t.includes('SPARVAGN')) {
      return '#047857'; // Dark green instead of light green
    }

    // Boat / Ferry / Båt / Färja - Dark teal
    if (t.includes('FERRY') || t.includes('BOAT') || t.includes('BÅT') || t.includes('BAT') || t.includes('FÄRJA') || t.includes('FARJA') || t.includes('ÄLVSNABBEN')) {
      return '#0f766e'; // Dark teal instead of light teal
    }

    // Bus - Based on line number ranges (darker, more accessible colors)
    if (lineNum >= 1 && lineNum <= 99) {
      // Local buses - Dark orange instead of bright orange
      return '#c2410c';
    } else if (lineNum >= 100 && lineNum <= 199) {
      // Regional buses - Dark purple
      return '#6b21a8';
    } else if (lineNum >= 200 && lineNum <= 299) {
      // Express buses - Dark red
      return '#dc2626';
    } else if (lineNum >= 300 && lineNum <= 399) {
      // Airport buses - Dark blue
      return '#1d4ed8';
    }

    // Default fallback - Dark gray
    return '#475569';
  };

  // Check for station-based disruptions and withdrawals
  const [stationDisruptions, setStationDisruptions] = useState<any[]>([]);
  const [withdrawnLines, setWithdrawnLines] = useState<Set<string>>(new Set());

  // Filter state
  const [showFilters, setShowFilters] = useState(false);
  const [transportFilter, setTransportFilter] = useState<string>('all');
  const [trackFilter, setTrackFilter] = useState<string>('all');
  const [showDisruptionDetails, setShowDisruptionDetails] = useState(false);

  // Expanded Departure State
  const [expandedDepartureId, setExpandedDepartureId] = useState<string | null>(null);
  const [journeyDetails, setJourneyDetails] = useState<JourneyDetail[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const toggleDepartureExpand = async (dep: Departure) => {
    // If clicking the same row, collapse it
    if (expandedDepartureId === dep.id) {
      setExpandedDepartureId(null);
      setJourneyDetails([]);
      return;
    }

    setExpandedDepartureId(dep.id);
    setLoadingDetails(true);
    setJourneyDetails([]);

    // Increment "Trips" counter for Statistics
    try {
      const current = localStorage.getItem('resmus_trip_count');
      const count = current ? parseInt(current) : 0;
      localStorage.setItem('resmus_trip_count', (count + 1).toString());
    } catch (e) {
      // Ignore storage errors
    }

    try {
      if (dep.journeyRef) {
        const details = await TransitService.getJourneyDetails(dep.journeyRef);
        setJourneyDetails(details);
      }
    } catch (e) {
      console.error("Failed to fetch details", e);
    } finally {
      setLoadingDetails(false);
    }
  };



  useEffect(() => {
    const fetchDisruptions = async () => {
      if (!station) {
        setStationDisruptions([]);
        setWithdrawnLines(new Set());
        return;
      }

      try {
        const disruptions = await TransitService.getVasttrafikDisruptions();
        const stationIssues: any[] = [];
        const withdrawn = new Set<string>();

        // Filter for this station
        disruptions.forEach((d: any) => {
          const affectedStops = d.affectedStopPoints || [];
          // Normalize text for matching, stripping city name for broader matching
          const cleanStationName = station.name.split(',')[0].trim().toLowerCase();

          // Check if GID matches OR if title/description contains the station name (relaxed match)
          const hasStation = affectedStops.some((s: any) => s.gid === station.id) ||
            d.title.toLowerCase().includes(cleanStationName) ||
            d.description.toLowerCase().includes(cleanStationName);

          if (hasStation) {
            stationIssues.push(d);

            // Check for withdrawn lines/stations
            const title = d.title.toLowerCase();
            const description = d.description.toLowerCase();

            if (title.includes('indragen') || title.includes('flyttad') ||
              description.includes('indragen') || description.includes('flyttad')) {

              // Extract line numbers from affected lines
              if (d.affectedLines) {
                d.affectedLines.forEach((line: any) => {
                  const lineNumber = line.designation.replace(/\D/g, '');
                  if (lineNumber) {
                    withdrawn.add(lineNumber);
                  }
                });
              }
            }
          }
        });

        setStationDisruptions(stationIssues);
        setWithdrawnLines(withdrawn);
      } catch (e) {
        console.error("Failed to fetch disruptions", e);
      }
    };

    fetchDisruptions();
  }, [station]);

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 relative overflow-hidden">

      {/* --- Root Mode Switcher (Compact) --- */}
      <div className="flex-none z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md shadow-sm border-b border-sky-100 dark:border-slate-800 px-4 py-2">
        <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl max-w-sm mx-auto w-full">
          <button
            onClick={() => setRootView('station')}
            className={`flex-1 py-1.5 text-xs font-black rounded-lg transition-all flex items-center justify-center gap-1.5 ${rootView === 'station' ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200/50'}`}
          >
            <FontAwesomeIcon icon={faMapPin} className="text-sm" />Hållplats
          </button>
          <button
            onClick={() => setRootView('planner')}
            className={`flex-1 py-1.5 text-xs font-black rounded-lg transition-all flex items-center justify-center gap-1.5 ${rootView === 'planner' ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200/50'}`}
          >
            <FontAwesomeIcon icon={faLocationArrow} className="text-sm" />Sök Resa
          </button>
        </div>
      </div>

      {rootView === 'planner' ? (
        <div className="flex-1 overflow-hidden relative">
          <TripPlanner />
        </div>
      ) : (
        <>
          {/* SEARCH LAYOUT - VISIBLE ONLY WHEN NO STATION IS SELECTED */}
          {!station && (
            <div className="flex-none z-20 bg-gradient-to-b from-white to-sky-50/50 dark:from-slate-900 dark:to-slate-950 shadow-sm pb-6 rounded-b-[2.5rem]">
              <div className="px-5 pt-4 pb-2 space-y-4">
                {/* Provider Selector Hidden - Moved to Input Icon */}

                <div className="relative shadow-xl shadow-sky-200/20 dark:shadow-none border border-sky-100/50 dark:border-slate-700/50 rounded-3xl bg-white dark:bg-slate-800 z-50 transition-all focus-within:ring-4 ring-sky-100 dark:ring-sky-900/30 focus-within:border-sky-300 transform transition-transform hover:scale-[1.01]">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <FontAwesomeIcon icon={faSearch} className="h-5 w-5 text-sky-400" />
                  </div>
                  <input
                    type="text"
                    className="block w-full pl-10 pr-12 py-3 bg-transparent border-none text-slate-800 dark:text-slate-100 placeholder-slate-400 rounded-2xl font-black text-base outline-none"
                    placeholder="Sök hållplats..."
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    autoFocus={!station}
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center gap-1">
                    {/* Provider Toggle (Small) */}
                    {!isSearching && !query && (
                      <button
                        onClick={() => { setProvider(provider === Provider.VASTTRAFIK ? Provider.RESROBOT : Provider.VASTTRAFIK); setStation(null); setDepartures([]); }}
                        className={`p-1.5 rounded-full transition-colors ${provider === Provider.RESROBOT ? 'text-sky-600 bg-sky-50' : 'text-slate-300 hover:text-sky-500'}`}
                        title={provider === Provider.VASTTRAFIK ? "Byt till Resrobot (Hela Sverige)" : "Byt till Västtrafik"}
                      >
                        <FontAwesomeIcon icon={faGlobe} className="text-sm" />
                      </button>
                    )}

                    {isSearching ? <ThemedSpinner size={16} className="text-sky-500" /> : query.length > 0 ? <button onClick={() => setQuery('')} className="p-1 rounded-full text-slate-400 hover:text-slate-600"><FontAwesomeIcon icon={faChevronUp} className="w-3.5 h-3.5" /></button> : null}
                  </div>

                  {/* Search Results Dropdown */}
                  {(searchResults.length > 0 || (showSuggestions && !query && !station)) && (
                    <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-100 dark:border-slate-800 max-h-[50vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200 pb-2">
                      {/* Location Option - Show when query is empty */}
                      {(!query && showSuggestions && !station) && (
                        <button onMouseDown={handleUseLocation} className="w-full text-left px-4 py-3 border-b border-slate-50 dark:border-slate-800 hover:bg-sky-50 dark:hover:bg-slate-800 flex items-center gap-3 text-sky-600 dark:text-sky-400">
                          <div className="w-7 h-7 rounded-full bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center">
                            <FontAwesomeIcon icon={faLocationArrow} className="text-sm" />
                          </div>
                          <span className="font-bold text-sm">Visa hållplatser nära mig</span>
                        </button>
                      )}

                      {locationError && !query && (
                        <div className="px-4 py-2 text-xs text-red-500 font-bold bg-red-50 dark:bg-red-900/10 mx-2 mt-2 rounded-lg">{locationError}</div>
                      )}

                      {searchResults.map((s, idx) => (
                        <button key={`${s.id}-${idx}`} onClick={() => handleSelectStation(s)} className="w-full text-left px-4 py-2.5 hover:bg-sky-50 dark:hover:bg-slate-800 flex items-center gap-3 border-b border-slate-50 dark:border-slate-800">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center bg-blue-50 dark:bg-blue-900/20 text-blue-600"><FontAwesomeIcon icon={faMapPin} className="text-sm" /></div>
                          <div className="font-bold text-slate-800 dark:text-slate-200 text-sm">{s.name}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}



          {/* STATION HEADER - VISIBLE ONLY WHEN STATION IS SELECTED - MOVED BELOW BLUE HEADER */}
          {station && (
            <div className="flex-none z-20 bg-white dark:bg-slate-900 shadow-sm pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex flex-col px-4 pt-4 animate-in slide-in-from-top-4 fade-in duration-500">
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0 mr-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <h1 className="text-2xl font-black text-slate-800 dark:text-white truncate tracking-tight">{station.name}</h1>
                      <FontAwesomeIcon icon={faMapPin} className="text-sky-500 flex-shrink-0 text-xl opacity-20" />
                      {station.coords && <WeatherDisplay lat={station.coords.lat} lon={station.coords.lng} />}
                    </div>

                    {/* Show withdrawn lines */}
                    {withdrawnLines.size > 0 && (
                      <div className="mt-1 flex items-center gap-1.5 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-md border border-red-100 dark:border-red-900/30">
                        <FontAwesomeIcon icon={faExclamationCircle} className="text-sm" />
                        <span className="text-xs font-bold uppercase tracking-wide">
                          Linje {Array.from(withdrawnLines).join(', ')} indragen
                        </span>
                      </div>
                    )}

                    {/* Station Disruptions - "Mini snygg ruta" */}
                    {stationDisruptions.length > 0 && (
                      <div className="mt-2 text-left">
                        {/* Always use the collapsible "Mini" style, but red if severe */}
                        <div className={`bg-gradient-to-r ${stationDisruptions.some((d: any) => d.severity === 'severe' || d.title.toLowerCase().includes('indragen')) ? 'from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 border-red-200/50 dark:border-red-700/30' : 'from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-amber-200/50 dark:border-amber-700/30'} border rounded-xl p-2.5 flex items-start gap-2.5 shadow-sm group cursor-pointer relative overflow-hidden transition-all active:scale-[0.98]`}
                          onClick={() => setShowDisruptionDetails(!showDisruptionDetails)}>

                          {/* Decorative Background Element */}
                          <div className={`absolute -right-2 -top-2 w-8 h-8 rounded-full ${stationDisruptions.some((d: any) => d.severity === 'severe' || d.title.toLowerCase().includes('indragen')) ? 'bg-red-400/10 dark:bg-red-500/10' : 'bg-amber-400/10 dark:bg-amber-500/10'} blur-xl`}></div>

                          <div className="flex-1 min-w-0 pl-1">
                            <p className={`text-[11px] font-medium ${stationDisruptions.some((d: any) => d.severity === 'severe' || d.title.toLowerCase().includes('indragen')) ? "text-red-900 dark:text-red-200" : "text-amber-900 dark:text-amber-200"} leading-relaxed`}>
                              {(() => {
                                const d = stationDisruptions[0];
                                const lines = d.affectedLines?.map((l: any) => `Linje ${l.designation}`).join(', ');
                                const stops = d.affectedStopPoints?.some((s: any) => s.gid === station.id) ? station.name : "";

                                let scope = "";
                                if (lines && stops) scope = `${lines}, ${stops}`;
                                else if (lines) scope = lines;
                                else if (stops) scope = stops;
                                else scope = "Hållplatsen";

                                let status = d.title;
                                if (status.toLowerCase().includes('indragen')) status = "är indragen";

                                return `Trafikläge: ${scope} ${status}. ${d.description}`;
                              })()}
                            </p>

                            {stationDisruptions.length > 1 && (
                              <div className="mt-1.5 pt-1.5 border-t border-black/5 dark:border-white/10">
                                <span className={`text-[9px] font-bold ${stationDisruptions.some((d: any) => d.severity === 'severe' || d.title.toLowerCase().includes('indragen')) ? "text-red-700/70 dark:text-red-400" : "text-amber-700/70 dark:text-amber-400"}`}>
                                  +{stationDisruptions.length - 1} meddelande(n) till
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="self-center transform transition-transform duration-300" style={{ transform: showDisruptionDetails ? 'rotate(180deg)' : 'none' }}>
                            <FontAwesomeIcon icon={faChevronUp} className={stationDisruptions.some((d: any) => d.severity === 'severe' || d.title.toLowerCase().includes('indragen')) ? "text-red-400 dark:text-red-600" : "text-amber-400 dark:text-amber-600"} />
                          </div>
                        </div>

                        {/* Expanded Details - Only show remaining messages if needed */}
                        {showDisruptionDetails && stationDisruptions.length > 0 && (
                          <div className="mt-2 pl-3 space-y-2 animate-in slide-in-from-top-2 fade-in">
                            {stationDisruptions.map((d, index) => (
                              <div key={index} className={`${d.severity === 'severe' || d.title.toLowerCase().includes('indragen') ? 'bg-red-50/50 dark:bg-red-900/10 border-red-400' : 'bg-amber-50/50 dark:bg-amber-900/10 border-amber-400'} border-l-2 p-2.5 rounded-r-lg`}>
                                <h4 className={`text-xs font-bold ${d.severity === 'severe' || d.title.toLowerCase().includes('indragen') ? 'text-red-900 dark:text-red-100' : 'text-amber-900 dark:text-amber-100'} mb-1 leading-tight`}>{d.title}</h4>
                                <p className={`text-[10px] ${d.severity === 'severe' || d.title.toLowerCase().includes('indragen') ? 'text-red-800/80 dark:text-red-300' : 'text-amber-800/80 dark:text-amber-300'} leading-relaxed max-w-prose`}>
                                  {d.description}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => toggleFavorite(station)}
                      className={`p-2 rounded-full transition-all ${isStationFavorite(station) ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-500' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600'}`}
                    >
                      <FontAwesomeIcon icon={faStar} className="text-lg" />
                    </button>
                    <button onClick={() => setStation(null)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors">
                      <FontAwesomeIcon icon={faTimes} className="text-lg" />
                    </button>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* Blue Header Bar (With Integrated Controls) */}
          {station && (
            <div className="bg-sky-400 text-white text-xs font-black uppercase tracking-wider py-1.5 px-4 relative flex items-center shadow-md z-10">

              {/* Grid Layout for Column Headers - Absolute to match content below */}
              <div className="grid grid-cols-[60px_1fr_50px_50px_35px] gap-2 w-full items-center">
                <div onClick={toggleSort} className="cursor-pointer flex items-center gap-1 hover:text-sky-200">
                  Linje <FontAwesomeIcon icon={faArrowsAltV} className="text-[10px]" />
                </div>
                <div>Destination</div>
                <div className="text-right">Tid</div>
                <div className="text-right">Ny</div>
                <div className="text-right">Läge</div>
              </div>

              {/* Centered View Controls (Floating) */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1 bg-sky-600/90 rounded-full px-2 py-0.5 shadow-sm backdrop-blur-sm border border-sky-400/50">
                {/* Avg/Ank Toggles */}
                <button
                  onClick={() => setViewMode('departures')}
                  className={`px-2 py-1 flex items-center gap-1 rounded-full transition-all ${viewMode === 'departures' ? 'bg-white text-sky-600 shadow-sm' : 'text-sky-50 hover:text-white hover:bg-sky-500'}`}
                  title="Avgångar"
                >
                  <FontAwesomeIcon icon={faArrowUp} className="text-xs rotate-45" />
                  <span className="text-[9px] font-black uppercase tracking-wider">Avgångar</span>
                </button>
                <button
                  onClick={() => setViewMode('arrivals')}
                  className={`px-2 py-1 flex items-center gap-1 rounded-full transition-all ${viewMode === 'arrivals' ? 'bg-white text-sky-600 shadow-sm' : 'text-sky-50 hover:text-white hover:bg-sky-500'}`}
                  title="Ankomster"
                >
                  <FontAwesomeIcon icon={faArrowDown} className="text-xs rotate-45" />
                  <span className="text-[9px] font-black uppercase tracking-wider">Ankomst</span>
                </button>

                <div className="w-[1px] h-3 bg-sky-400 mx-0.5 opacity-50"></div>

                {/* Time Picker Compact */}
                {/* Time Controls (Merged) */}
                <div className="flex items-center bg-sky-800/20 rounded-full pl-0.5 pr-0.5 py-0.5 gap-0.5 border border-sky-400/20 backdrop-blur-sm">
                  <div className="relative group flex items-center justify-center">
                    {customTime ? (
                      <button onClick={() => setCustomTime('')} className="p-1 text-sky-200 hover:text-white bg-sky-800/50 rounded-full">
                        <span className="text-[9px] font-bold px-1">{new Date(customTime).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}</span>
                      </button>
                    ) : (
                      <>
                        <button className="p-1 text-sky-100 hover:text-white transition-colors rounded-full hover:bg-sky-500" title="Välj tid">
                          <FontAwesomeIcon icon={faCalendarAlt} className="text-sm" />
                        </button>
                        <input
                          type="datetime-local"
                          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                          onChange={(e) => setCustomTime(e.target.value)}
                        />
                      </>
                    )}
                  </div>

                  <div className="w-[1px] h-3 bg-white/20 mx-0.5"></div>

                  {/* Shortcuts inline */}
                  {[360, 1440].map(mins => (
                    <button
                      key={mins}
                      onClick={() => { setTimeWindow(mins); fetchData(); }}
                      className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold transition-all ${timeWindow === mins ? 'bg-white text-sky-600 shadow-sm' : 'text-sky-200 hover:text-white hover:bg-sky-500/50'}`}
                      title={`Visa ${mins === 1440 ? '24h' : '6h'} framåt`}
                    >
                      {mins === 360 ? '6h' : '24h'}
                    </button>
                  ))}
                </div>


                {/* Time Window Selector */}


                <div className="w-[1px] h-3 bg-sky-400 mx-0.5 opacity-50"></div>

                {/* Min/Tid Toggle */}
                <button
                  onClick={() => setTimeDisplayMode(timeDisplayMode === 'minutes' ? 'clock' : 'minutes')}
                  className="p-1 rounded-full text-sky-100 hover:text-white hover:bg-sky-500 transition-colors"
                  title={timeDisplayMode === 'minutes' ? 'Byt till klocktid' : 'Byt till minuter'}
                >
                  <FontAwesomeIcon icon={faClock} className="text-sm" />
                </button>
              </div>

            </div>
          )}

          {/* List Content */}
          <div className="flex-1 overflow-y-auto bg-white dark:bg-slate-950 pb-20">
            {!station ? (
              <div className="p-4">


                {favorites.length > 0 && (
                  <div className="mb-2">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3 px-1">Dina Favoriter</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {favorites.map(fav => (
                        <div key={fav.id} onClick={() => handleSelectStation(fav)} className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl flex items-center justify-between group cursor-pointer hover:border-sky-500 dark:hover:border-sky-500 transition-colors shadow-sm">
                          <div className="flex items-center gap-3 overflow-hidden">
                            <div className="w-8 h-8 rounded-full bg-yellow-100 dark:bg-yellow-900/20 text-yellow-500 flex items-center justify-center flex-shrink-0">
                              <FontAwesomeIcon icon={faStar} className="text-sm" />
                            </div>
                            <span className="font-bold text-slate-800 dark:text-white truncate text-sm">{fav.name}</span>
                          </div>
                          <button onClick={(e) => { e.stopPropagation(); toggleFavorite(fav); }} className="text-slate-300 hover:text-red-500 transition-colors p-1">
                            <FontAwesomeIcon icon={faTrash} className="text-sm" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!favorites.length && (
                  <div className="flex flex-col items-center justify-center pt-20 text-center opacity-40">
                    <FontAwesomeIcon icon={faStar} className="text-5xl text-slate-300 mb-4" />
                    <p className="font-bold text-slate-400">Du har inga favoriter än.</p>
                    <p className="text-xs text-slate-400 mt-1">Sök på en hållplats och klicka på stjärnan.</p>
                  </div>
                )}
              </div>
            ) : (
              <>
                {loading && departures.length === 0 ? (
                  <div>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <DepartureSkeleton key={i} />
                    ))}
                  </div>
                ) : sortedDepartures.length > 0 ? (
                  <div>
                    {sortedDepartures.map((dep, idx) => {
                      const isCancelled = dep.status === 'CANCELLED';
                      const hasRealtime = !!dep.realtime;
                      const isDeviation = hasRealtime && dep.realtime !== dep.time;

                      // Check for Disruption (Any severity, as long as it's not cancelled)
                      // This ensures the blue 'i' icon appears for delays, moves, or general info.
                      const hasDisruptionInfo = dep.hasDisruption && !isCancelled;

                      let displayDirection = dep.direction;
                      if ((displayDirection === 'Okänd' || displayDirection === '') && station) {
                        displayDirection = viewMode === 'arrivals' ? "Ankommande" : station.name;
                      }
                      const showOriginPrefix = viewMode === 'arrivals' && !displayDirection.startsWith('Från') && displayDirection !== 'Ankommande';

                      const getDisplayTime = (timeStr: string, ts?: string) => {
                        if (!ts) return timeStr;
                        const diff = (new Date(ts).getTime() - Date.now()) / 60000;
                        if (diff <= 3) {
                          const m = Math.floor(diff);
                          if (m <= 0) return "Nu"; // Changed to handle -0 and negative nicely
                          return `${m} min`;
                        }
                        return timeStr;
                      };

                      // Filter out departures that have already happened (> 1 min ago)
                      // We do this check here to filter "live" without refetching
                      // TODO: Better might be to filter `sortedDepartures` but useEffect runs every 15s.
                      // Filter out departures that have already happened (> 0.5 min ago)
                      const diff = dep.timestamp ? (new Date(dep.timestamp).getTime() - Date.now()) / 60000 : 0;
                      if (diff < -0.5) return null;

                      // Smart Time Logic
                      const minsRemaining = Math.ceil(diff);
                      const isCloseDeparture = minsRemaining <= 5 && minsRemaining >= -1;
                      // Show minutes if mode is 'minutes' OR if it's a close departure with realtime data (Smart Time default)
                      const displayRealtimeInMinutes = timeDisplayMode === 'minutes' || (isCloseDeparture && hasRealtime);

                      // If close departure, HIDE scheduled time, show ONLY realtime in "Ny Tid" col
                      // If NOT close, show scheduled in "Tid", and realtime in "Ny Tid" ONLY if deviation

                      return (
                        <div
                          key={`${dep.id}-${idx}`}
                          className={`relative group/row ${isCancelled ? '' : ''}`}
                        >
                          <div
                            onClick={() => toggleDepartureExpand(dep)}
                            className={`grid grid-cols-[60px_1fr_50px_50px_35px] gap-2 items-center px-2 py-0.5 md:py-1 border-b border-slate-100 dark:border-slate-800 transition-colors relative z-10 cursor-pointer
                            ${isCancelled
                                ? 'bg-red-50/70 dark:bg-red-900/20 border-l-2 border-l-red-500'
                                : 'border-l-2 border-l-transparent hover:bg-slate-50 dark:hover:bg-slate-900'
                              }
                        ${expandedDepartureId === dep.id ? 'bg-slate-50 dark:bg-slate-900 shadow-inner' : ''}
                         `}>

                            {/* Linje */}
                            <div className="flex items-center gap-1 cursor-pointer hover:scale-105 transition-transform"
                              title="Sätt avgångslarm"
                              onClick={(e) => {
                                e.stopPropagation();
                                const dueTime = new Date(dep.datetime).getTime();
                                if (dueTime > Date.now()) {
                                  const alarmId = `${dep.stopPoint?.name || station?.name}-${dep.line}-${dep.timestamp}`;
                                  const stationName = dep.stopPoint?.name || station?.name || "Unknown Station";
                                  addAlarm({
                                    id: alarmId,
                                    departureTime: dep.timestamp,
                                    dueTime: dueTime,
                                    stationName: stationName,
                                    line: dep.line,
                                    direction: dep.direction
                                  });
                                  toast.success(`Larm satt!`, `Du får en notis inför avgång med linje ${dep.line}.`);
                                }
                              }}>
                              <div className={`relative inline-block ${isCancelled ? 'opacity-70 grayscale-[0.4]' : ''}`}>
                                <div
                                  className="h-5 md:h-6 min-w-[28px] md:min-w-[32px] px-1 rounded-md flex items-center justify-center font-black text-[10px] md:text-xs text-white shadow-md border border-white/20 bg-gradient-to-b from-white/20 to-transparent"
                                  style={{
                                    backgroundColor: dep.bgColor || getDefaultLineColor(dep.type, dep.line),
                                    color: dep.fgColor || '#ffffff',
                                    textShadow: '0 1px 2px rgba(0,0,0,0.5)'
                                  }}
                                >
                                  {dep.track === 'X' ? <FontAwesomeIcon icon={faTaxi} className="text-[16px]" /> : (
                                    <span className="mx-0.5">{dep.line === '?' ? '-' : dep.line}</span>
                                  )}
                                </div>
                                {alarms.some(a => a.id === `${dep.stopPoint?.name || station?.name}-${dep.line}-${dep.timestamp}`) && (
                                  <div className="absolute -top-1.5 -right-1.5 bg-sky-500 text-white rounded-full p-0.5 shadow-sm border border-white z-10 animate-in zoom-in-50">
                                    <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Destination */}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <div className={`font-bold text-xs md:text-sm truncate leading-tight ${isCancelled ? 'text-slate-400 line-through decoration-red-400 decoration-2' : 'text-slate-800 dark:text-slate-100'}`}>
                                  {showOriginPrefix ? `Från ${displayDirection}` : displayDirection}
                                </div>
                                {hasDisruptionInfo && <DisruptionInfoIcon />}
                              </div>
                              {dep.track === 'X' && (
                                <div className="flex items-center gap-1 mt-0.5">
                                  <span className="bg-sky-100 dark:bg-sky-900 text-sky-700 dark:text-sky-300 text-[9px] font-black uppercase px-1 rounded border border-sky-200 dark:border-sky-800">Förbokas</span>
                                  <span className="text-[9px] text-slate-400 hidden sm:inline">Ring 0771-91 90 90 (minst 1h innan)</span>
                                </div>
                              )}
                              {dep.disruptionMessage && (
                                <div className="flex items-start gap-1 mt-1 animate-in zoom-in-95 origin-top-left">
                                  <FontAwesomeIcon icon={faExclamationCircle} className="text-red-500 mt-[1px] text-[10px] flex-shrink-0" />
                                  <span className="text-[10px] font-bold text-red-600 dark:text-red-400 leading-tight">
                                    {dep.disruptionMessage}
                                  </span>
                                </div>
                              )}
                              {isCancelled && !dep.disruptionMessage && (
                                <div className="flex items-center gap-1 mt-0.5 text-red-600 dark:text-red-400">
                                  <FontAwesomeIcon icon={faBan} className="text-[10px]" />
                                  <span className="text-[10px] font-black uppercase tracking-wider">Inställd</span>
                                </div>
                              )}
                            </div>

                            {/* Tid (Scheduled) - Respects timeDisplayMode */}
                            <div className={`text-right font-bold text-xs md:text-sm leading-tight whitespace-nowrap ${isCancelled ? 'text-slate-400/50 line-through decoration-slate-300' : (isDeviation ? 'text-slate-500 dark:text-slate-400' : 'text-slate-800 dark:text-white')}`}>
                              {timeDisplayMode === 'minutes' && displayRealtimeInMinutes
                                ? ""
                                : dep.time
                              }
                            </div>

                            {/* Ny Tid (Realtime) - Respects timeDisplayMode */}
                            <div className="text-right whitespace-nowrap">
                              {isCancelled ? (
                                <div className="flex justify-end">
                                  <FontAwesomeIcon icon={faTimes} className="text-red-500 text-xl" />
                                </div>
                              ) : (
                                timeDisplayMode === 'minutes' ? (
                                  (isDeviation || displayRealtimeInMinutes) ? (
                                    <span className={`font-black text-xs md:text-sm px-1.5 py-0.5 rounded leading-none inline-block ${displayRealtimeInMinutes ? "text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/40" : "text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-900/30"}`}>
                                      {displayRealtimeInMinutes ? (minsRemaining <= 0 ? "Nu" : `${minsRemaining} min`) : getDisplayTime(dep.realtime || dep.time, dep.timestamp)}
                                    </span>
                                  ) : null
                                ) : (
                                  hasRealtime && isDeviation ? (
                                    <span className="font-black text-xs md:text-sm px-1.5 py-0.5 rounded leading-none text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-900/30 inline-block">
                                      {dep.realtime}
                                    </span>
                                  ) : null
                                )
                              )}
                            </div>

                            {/* Läge (Track) - Premium Redesign */}
                            <div className="flex justify-end">
                              {isCancelled ? <span className="text-slate-300 font-bold">-</span> : (dep.track ? (
                                <div className="flex flex-col items-center">
                                  <span className="inline-flex items-center justify-center bg-slate-800 dark:bg-slate-700 text-white min-w-[24px] h-[24px] px-1.5 rounded-md font-black text-[11px] shadow-sm border border-slate-700 dark:border-slate-600 ring-1 ring-slate-900/50 dark:ring-slate-600/50 transition-all group-hover/row:scale-110 group-hover/row:shadow-md group-hover/row:border-white/50">
                                    {dep.track}
                                  </span>
                                </div>
                              ) : <span className="text-slate-300 font-bold">-</span>)}
                            </div>
                          </div>

                          {/* Expanded Details Map */}
                          {expandedDepartureId === dep.id && (
                            <div className="bg-slate-50 dark:bg-slate-900/50 p-3 border-b border-slate-100 dark:border-slate-800 animate-in slide-in-from-top-2 fade-in duration-200 cursor-default" onClick={(e) => e.stopPropagation()}>
                              {loadingDetails ? (
                                <div className="h-32 flex items-center justify-center">
                                  <ThemedSpinner size={24} className="text-sky-500" />
                                </div>
                              ) : journeyDetails.length > 0 ? (
                                <div>
                                  <div className="mb-2 flex items-center justify-between">
                                    <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">Färdväg</h4>
                                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{journeyDetails.length} hållplatser</span>
                                  </div>
                                  <DepartureRouteMap stops={journeyDetails} color={dep.bgColor || '#0ea5e9'} />

                                  {/* Journey Details Timeline List */}
                                  <div className="mt-4 pl-2 relative">
                                    {/* Vertical Line */}
                                    <div className="absolute top-2 left-[19px] bottom-4 w-0.5 bg-slate-200 dark:bg-slate-800"></div>

                                    <div className="space-y-0">
                                      {journeyDetails.map((stop, idx) => {
                                        const isFirst = idx === 0;
                                        const isLast = idx === journeyDetails.length - 1;

                                        return (
                                          <div key={idx} className="relative flex items-center gap-3 py-2 group">
                                            {/* Dot */}
                                            <div className={`relative z-10 w-4 h-4 rounded-full border-2 border-white dark:border-slate-900 ${isFirst || isLast ? 'bg-slate-800 dark:bg-white w-5 h-5' : 'bg-slate-400 dark:bg-slate-600'}`}>
                                              {(isFirst || isLast) && <div className="absolute inset-0 m-auto w-1.5 h-1.5 bg-white dark:bg-slate-900 rounded-full"></div>}
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0 bg-white dark:bg-slate-800 p-2 rounded-lg shadow-sm border border-slate-100 dark:border-slate-700/50 flex items-center justify-between gap-3">
                                              <div className="min-w-0">
                                                <div className="font-bold text-sm text-slate-800 dark:text-slate-200 truncate">{stop.name}</div>
                                              </div>
                                              <div className="text-right flex-shrink-0">
                                                <div className="font-bold text-sm text-slate-700 dark:text-slate-300">{stop.time}</div>
                                                {stop.track && (
                                                  <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-900 px-1 rounded inline-block mt-0.5">
                                                    Läge {stop.track}
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-center py-4 text-slate-400 text-xs">
                                  Ingen färdvägsinformation tillgänglig.
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                    <div className="py-6"></div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center pt-16 text-slate-400 opacity-60">
                    <FontAwesomeIcon icon={faExclamationCircle} className="text-3xl mb-2" />
                    <p className="text-sm font-bold">Inga avgångar hittades</p>
                    {customTime && <p className="text-xs mt-1">Försök att ändra tiden eller sök igen.</p>}
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )
      }
    </div >
  );
};
