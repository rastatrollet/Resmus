import React, { useState, useEffect } from 'react';
import { Departure, Station, Provider, JourneyDetail, TrafficSituation } from '../types';
import { TransitService } from '../services/transitService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faMapPin, faArrowUp, faArrowDown, faChevronUp, faExclamationCircle, faExclamationTriangle, faArrowsAltV, faCalendarAlt, faTimes, faBus, faLocationArrow, faTram, faShip, faBan, faStar, faTrash, faWalking, faTaxi, faFilter, faChevronLeft, faChevronRight, faInfoCircle, faClock, faGlobe, faMap, faTrain, faSubway, faMapMarkerAlt, faLocationDot, faSearchPlus, faSearchMinus } from '@fortawesome/free-solid-svg-icons';
import { DepartureSkeleton, ThemedSpinner } from './Loaders';

import { WeatherDisplay } from './WeatherDisplay';
import { DepartureRouteMap } from './DepartureRouteMap';
import { useAlarms } from '../hooks/useAlarms';
import { TripPlanner } from './TripPlanner';

interface DeparturesBoardProps {
  initialStation?: Station;
  mode?: 'departures' | 'arrivals';
}

const getMs = (t: string | undefined, refDate: Date = new Date()) => {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  const d = new Date(refDate);
  d.setHours(h, m, 0, 0);
  const now = Date.now();
  // Handle wraparound roughly
  const diff = d.getTime() - now;
  if (diff > 43200000) d.setDate(d.getDate() - 1);
  else if (diff < -43200000) d.setDate(d.getDate() + 1);
  return d.getTime();
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

const JourneyTimeline = ({ stops, type, currentStationName }: { stops: JourneyDetail[], type?: string, currentStationName?: string }) => {
  const [activeState, setActiveState] = useState({ segment: -1, progress: 0 });

  useEffect(() => {
    const update = () => {
      const now = Date.now();
      let segment = -1;
      let progress = 0;

      const getMsLocal = (t: string | undefined) => getMs(t);

      for (let i = 0; i < stops.length - 1; i++) {
        const curr = stops[i];
        const next = stops[i + 1];
        const t1 = getMsLocal(curr.realtimeDeparture || curr.departureTime || curr.time);
        const t2 = getMsLocal(next.realtimeArrival || next.arrivalTime || next.time);

        if (t1 && t2 && now >= t1 && now <= t2) {
          segment = i;
          progress = (now - t1) / (t2 - t1);
          break;
        }
      }
      setActiveState({ segment, progress });
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [stops]);

  // Handle locale safely for Swedish time format consistent with UI
  const formatTimeStr = (t: string | undefined) => t ? t.replace('.', ':').substring(0, 5) : '';

  return (
    <div className="relative pl-0 pt-1 pb-1">
      {/* Background Line - Compact alignment: 40px time + 12px gap + 10px center = 62px */}
      <div className="absolute left-[62px] top-4 bottom-4 w-0.5 bg-slate-200 dark:bg-slate-700"></div>

      {stops.map((stop, idx) => {
        const isCancelled = stop.isCancelled;
        const isActive = stop.name === currentStationName;

        // Times
        const depTime = formatTimeStr(stop.departureTime || stop.time);
        const depReal = formatTimeStr(stop.realtimeDeparture);
        const arrTime = formatTimeStr(stop.arrivalTime || stop.time);
        const arrReal = formatTimeStr(stop.realtimeArrival);

        let showDouble = false;
        if (idx > 0 && idx < stops.length - 1) {
          if (arrTime !== depTime || arrReal !== depReal) showDouble = true;
        }

        const renderTimeBlock = (sched: string, real?: string) => {
          const isLate = real && real !== sched;
          return (
            <div className="flex flex-col items-end leading-tight">
              {isLate && <span className="text-[9px] text-slate-400 line-through decoration-slate-400 decoration-1">{sched}</span>}
              <span className={`font-bold text-xs ${isLate ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/40 px-1 rounded -my-0.5' : (isCancelled ? 'text-red-500' : 'text-slate-700 dark:text-slate-300')}`}>
                {real || sched}
              </span>
            </div>
          )
        }

        return (
          <div key={idx} className={`relative flex gap-3 min-h-[2.25rem] ${activeState.segment > idx ? 'opacity-40' : ''}`}>
            {/* Left: Time - Compact Width 40px */}
            <div className="w-[40px] text-right flex flex-col items-end justify-center shrink-0">
              {showDouble ? (
                <>
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 w-5 text-right">AVG</span>
                    {renderTimeBlock(depTime, depReal)}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 w-5 text-right">ANK</span>
                    {renderTimeBlock(arrTime, arrReal)}
                  </div>
                </>
              ) : (
                renderTimeBlock(idx === 0 ? depTime : arrTime, idx === 0 ? depReal : arrReal)
              )}
            </div>

            {/* Center: Dot & Vehicle */}
            <div className="relative flex flex-col items-center w-5 shrink-0 z-10 pt-1">
              <div className={`w-3 h-3 rounded-full border-[2px] box-content bg-white dark:bg-slate-900 transition-all ${isActive ? 'border-sky-500 scale-125 shadow-[0_0_8px_rgba(14,165,233,0.5)]' :
                (activeState.segment > idx ? 'border-slate-300 dark:border-slate-700' : 'border-slate-400 dark:border-slate-500')
                }`}></div>

              {/* Vehicle Icon */}
              {activeState.segment === idx && (
                <div className="absolute top-2 w-0.5" style={{ height: 'calc(100% + 1rem)', zIndex: 20 }}>
                  <div className="absolute left-1/2 -translate-x-1/2 w-5 h-5 bg-sky-500 border-2 border-white text-white rounded-full flex items-center justify-center shadow-md text-[9px] transition-all duration-1000 ease-linear"
                    style={{ top: `${activeState.progress * 100}%` }}>
                    <FontAwesomeIcon icon={type === 'TRAM' ? faTram : faBus} />
                  </div>
                </div>
              )}
            </div>

            {/* Right: Info */}
            <div className="flex-1 pt-0.5 pb-2 border-b border-slate-100 dark:border-slate-800/40 flex items-center flex-wrap">
              <div className={`font-medium text-sm mr-2 ${isActive ? 'text-sky-600' : 'text-slate-800 dark:text-slate-200'} ${isCancelled ? 'line-through decoration-red-500 text-red-700' : ''}`}>
                {stop.name}
              </div>
              {isCancelled && <span className="text-red-500 text-[10px] font-bold uppercase tracking-wide mr-2">Inställd</span>}
              {stop.track && !isCancelled && (
                <span className="ml-auto text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700" title={`Läge ${stop.track}`}>
                  {stop.track}
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div >
  )
};

import { useToast } from './ToastProvider';

export const DeparturesBoard: React.FC<DeparturesBoardProps> = ({ initialStation, mode = 'departures' }) => {
  const toast = useToast();
  const { addAlarm, alarms } = useAlarms();
  // View Mode State (Station vs Trip Planner)
  const [rootView, setRootView] = useState<'station' | 'planner'>('station');

  // Search & Station State
  const [query, setQuery] = useState('');
  const [station, setStation] = useState<Station | null>(initialStation || null);
  const [provider, setProvider] = useState<Provider>(() => {
    return (localStorage.getItem('resmus_storage_provider') as Provider) || Provider.VASTTRAFIK;
  });

  // Effect moved below state declarations
  const [departures, setDepartures] = useState<Departure[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<Station[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [viewMode, setViewMode] = useState<'departures' | 'arrivals'>(mode);
  const [sortMode, setSortMode] = useState<'time' | 'line'>('time');
  const [timeDisplayMode, setTimeDisplayMode] = useState<'minutes' | 'clock'>('clock');
  const [isDense, setIsDense] = useState(false);


  const [customTime, setCustomTime] = useState<string>(''); // YYYY-MM-DDTHH:MM
  const [timeWindow, setTimeWindow] = useState(() => parseInt(localStorage.getItem('resmus_time_span') || '240', 10)); // Default 4 hours

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // --- MOVED STATE UP TO FIX REFERENCE ERROR ---
  // Check for station-based disruptions and withdrawals
  const [stationDisruptions, setStationDisruptions] = useState<any[]>([]);
  const [withdrawnLines, setWithdrawnLines] = useState<Set<string>>(new Set());

  // Filter state
  const [showFilters, setShowFilters] = useState(false);
  const [transportFilter, setTransportFilter] = useState<string>('all');
  const [trackFilter, setTrackFilter] = useState<string>('all');
  const [showDisruptionDetails, setShowDisruptionDetails] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  // Expanded Departure State
  const [expandedDepartureId, setExpandedDepartureId] = useState<string | null>(null);
  const [journeyDetails, setJourneyDetails] = useState<JourneyDetail[]>([]);
  const [specificDisruptions, setSpecificDisruptions] = useState<TrafficSituation[] | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [showRouteMap, setShowRouteMap] = useState(false);
  const [nextStop, setNextStop] = useState<JourneyDetail | null>(null);
  const [detailsUpdatedAt, setDetailsUpdatedAt] = useState<Date | null>(null);

  // Track mount status for provider change logic
  const isMountedRef = React.useRef(false);

  // Clear station when provider changes (to prevent data mismatch)
  useEffect(() => {
    if (isMountedRef.current) {
      setStation(null);
      setDepartures([]);
      setSearchResults([]);
      setQuery('');
    } else {
      isMountedRef.current = true;
    }
  }, [provider]);

  // Listen for external updates (Settings)
  useEffect(() => {
    const handleStorageChange = () => {
      const newProvider = (localStorage.getItem('resmus_storage_provider') as Provider) || Provider.VASTTRAFIK;
      setProvider(newProvider);

      const newTimeWindow = parseInt(localStorage.getItem('resmus_time_span') || '60', 10);
      setTimeWindow(newTimeWindow);
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Update "Next Stop" based on time
  useEffect(() => {
    if (!journeyDetails.length) {
      setNextStop(null);
      return;
    }
    const updateNextStop = () => {
      const now = Date.now();
      // Find the first stop that we haven't departed from yet (or just arrived at)
      // Simple logic: Find first stop with departureTime > now. 
      // If we are between stops, the next one is the target.
      const next = journeyDetails.find(s => {
        const t = getMs(s.realtimeDeparture || s.departureTime || s.time);
        return t && t > now;
      });
      if (next) setNextStop(next);
      else if (journeyDetails.length > 0) {
        // If all passed, show last? or "End"
        setNextStop({ name: "Slutdestination" } as any);
      }
    };
    updateNextStop();
    const interval = setInterval(updateNextStop, 10000);
    return () => clearInterval(interval);
  }, [journeyDetails]);
  // ---------------------------------------------

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

  // Fetch data function
  useEffect(() => {
    let isMounted = true;
    let intervalId: NodeJS.Timeout;

    const fetchData = async () => {
      if (!station) return;

      setLoading(true);
      setError(null);
      // Don't clear departures immediately to prevent flash if refreshing
      // setDepartures([]); 

      const now = new Date();
      let dateTimeStr = customTime || undefined;

      console.log(`Fetching departures for ${station.name} (${station.id})...`);

      try {
        // Parallel fetch: Departures + Global Disruptions (if Västtrafik)
        const [data, fetchedDisruptions] = await Promise.all([
          TransitService.getDepartures(
            station.id,
            station.provider,
            viewMode,
            dateTimeStr,
            timeWindow
          ),
          station.provider === Provider.VASTTRAFIK ? TransitService.getVasttrafikDisruptions() : Promise.resolve([])
        ]);

        if (!isMounted) return;

        console.log(`Fetched ${data.length} departures and ${fetchedDisruptions.length} disruptions`);

        // Enhance departures with disruption info
        const enhancedDepartures = data.map(dep => {
          // If already has disruption from API, keep it
          if (dep.hasDisruption) return dep;

          // Match usage of global disruptions
          const matchingSituation = fetchedDisruptions.find(sit => {
            // Check if active time
            const startTime = new Date(sit.startTime).getTime();
            const endTime = sit.endTime ? new Date(sit.endTime).getTime() : Infinity;
            const nowTime = now.getTime();
            if (nowTime < startTime || nowTime > endTime) return false;

            // Check Line Name match (e.g. "3955", "Blå Tåget", "17")
            const affectedLine = sit.affectedLines?.some(l =>
              l.designation === dep.line || dep.line.includes(l.designation)
            );

            // Check Stop match
            const affectedStop = sit.affectedStopPoints?.some(s => s.gid === station.id);

            return affectedLine || affectedStop;
          });

          if (matchingSituation) {
            return {
              ...dep,
              hasDisruption: true,
              disruptionSeverity: matchingSituation.severity || 'normal',
              disruptionMessage: matchingSituation.title || matchingSituation.description
            };
          }
          return dep;
        });

        // Loop logic: If too few departures, try next day? (Simplified for stability)
        // For now, just set what we have.
        setDepartures(enhancedDepartures);

      } catch (err) {
        console.error("Fetch error:", err);
        if (isMounted) setError("Kunde inte hämta avgångar.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();
    intervalId = setInterval(fetchData, 60000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [station, viewMode, customTime, timeWindow]);

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

    // Type Filter
    if (transportFilter !== 'all') {
      // Map Västtrafik types roughly
      const type = (dep.type || '').toUpperCase();
      if (transportFilter === 'BUS' && !type.includes('BUS')) return false;
      if (transportFilter === 'TRAM' && !type.includes('TRAM') && !type.includes('SPÅRVAGN')) return false;
      if (transportFilter === 'TRAIN' && !type.includes('TRAIN') && !type.includes('TÅG')) return false;
      if (transportFilter === 'FERRY' && !type.includes('FERRY') && !type.includes('BÅT')) return false;
    }

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

  /* 
   * Color Mapping based on Operator/Region
   */
  const getOperatorColor = (operator: string | undefined) => {
    const op = (operator || '').toLowerCase();

    // Stockholm (SL) - Red/Blue
    if (op.includes('sl') || op.includes('stockholm')) return '#d90000'; // SL Red

    // Skånetrafiken - Green
    if (op.includes('skåne')) return '#00a54f'; // Skåne Green

    // Västtrafik - Blue (Default Resmus Brand)
    if (op.includes('västtrafik')) return '#0095ff';

    // Östgötatrafiken - Red/Orange
    if (op.includes('östgöta')) return '#ff5000';

    // UL (Uppsala) - Yellow
    if (op.includes('upplands') || op.includes('ul')) return '#bfae0a';

    // SJ - Gray/Black
    if (op.includes('sj')) return '#222222';

    // Vy - Green
    if (op.includes('vy')) return '#006241';

    // Mälartåg - Red/White
    if (op.includes('mälar')) return '#e30613';

    // Hallandstrafiken - Blue
    if (op.includes('halland')) return '#007ac9';

    return null; // Fallback to type-based
  };

  const getDefaultLineColor = (type: string | undefined, line: string, operator?: string) => {

    // 1. Check Operator specific overrides first (if ResRobot)
    const opColor = getOperatorColor(operator);
    if (opColor) return opColor;

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
    setSpecificDisruptions(null);
    setDetailsUpdatedAt(null);

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
        setDetailsUpdatedAt(new Date());
      }
      if (dep.serviceJourneyGid) {
        TransitService.getJourneyDisruptions(dep.serviceJourneyGid).then(disruptions => {
          if (expandedDepartureId === dep.id) {
            setSpecificDisruptions(disruptions);
          }
        });
      }
    } catch (e) {
      console.error("Failed to fetch details", e);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Auto-update journey details every 30 seconds
  useEffect(() => {
    if (!expandedDepartureId) return;

    const interval = setInterval(async () => {
      const dep = departures.find(d => d.id === expandedDepartureId);
      if (dep?.journeyRef) {
        try {
          const details = await TransitService.getJourneyDetails(dep.journeyRef);
          // Only update if we still have the same departure expanded
          setJourneyDetails(current => {
            return details;
          });
          setDetailsUpdatedAt(new Date());
        } catch (e) { console.error("Auto-refresh details failed", e); }
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [expandedDepartureId, departures]);
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
                        onClick={() => {
                          let next: Provider;
                          if (provider === Provider.VASTTRAFIK) next = Provider.TRAFIKVERKET;
                          else if (provider === Provider.TRAFIKVERKET) next = Provider.RESROBOT;
                          else next = Provider.VASTTRAFIK;

                          setProvider(next);
                          localStorage.setItem('resmus_storage_provider', next);
                          // Clean up previous results
                          setStation(null);
                          setDepartures([]);
                        }}
                        className={`p-1.5 rounded-full transition-colors flex items-center justify-center w-7 h-7
                            ${provider === Provider.RESROBOT ? 'text-sky-600 bg-sky-50' :
                            provider === Provider.TRAFIKVERKET ? 'text-red-600 bg-red-50' :
                              'text-blue-600 bg-blue-50 hover:bg-blue-100'}`}
                        title={
                          provider === Provider.VASTTRAFIK ? "Källa: Västtrafik (Klicka för att byta)" :
                            provider === Provider.TRAFIKVERKET ? "Källa: Trafikverket (Tåg)" :
                              "Källa: Resrobot (Hela Sverige)"
                        }
                      >
                        {provider === Provider.TRAFIKVERKET ? (
                          <span className="font-bold text-[10px] tracking-tighter">TV</span>
                        ) : (
                          <FontAwesomeIcon icon={faGlobe} className="text-sm" />
                        )}
                      </button>
                    )}

                    {isSearching ? <ThemedSpinner size={16} className="text-sky-500" /> : query.length > 0 ? <button onClick={() => setQuery('')} className="p-1 rounded-full text-slate-400 hover:text-slate-600"><FontAwesomeIcon icon={faChevronUp} className="w-3.5 h-3.5" /></button> : null}
                  </div>

                  {/* Search Results Dropdown */}
                  {((searchResults.length > 0) || (query && searchResults.length === 0 && !isSearching) || (showSuggestions && !query && !station)) && (
                    <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-100 dark:border-slate-800 max-h-[50vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200 pb-2">

                      {/* No Results Message */}
                      {query && searchResults.length === 0 && !isSearching && (
                        <div className="px-4 py-3 text-slate-500 dark:text-slate-400 text-sm text-center italic">
                          Inga hållplatser hittades via {provider === Provider.VASTTRAFIK ? 'Västtrafik' : provider === Provider.TRAFIKVERKET ? 'Trafikverket' : 'Resrobot'}.
                          <br /><span className="text-xs opacity-70">Prova att byta sökkälla med knappen till höger.</span>
                        </div>
                      )}
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
          {
            station && (
              <div className="flex-none z-20 bg-white dark:bg-slate-900 shadow-sm pb-2 border-b border-slate-100 dark:border-slate-800">
                <div className="flex flex-col px-4 pt-4 animate-in slide-in-from-top-4 fade-in duration-500">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0 mr-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <h1 className="text-2xl font-black text-slate-800 dark:text-white truncate tracking-tight">{station.name}</h1>




                        <div className="bg-sky-100 dark:bg-sky-900/30 p-1.5 rounded-full">
                          <FontAwesomeIcon icon={faLocationDot} className="text-sky-500 text-sm" />
                        </div>
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
            )
          }

          {/* Blue Header Bar (With Integrated Controls) */}
          {
            station && (
              <div className="bg-sky-400 text-white text-xs font-black uppercase tracking-wider py-1.5 px-4 relative flex items-center shadow-md z-10">

                {/* Grid Layout for Column Headers - Absolute to match content below */}
                {/* Header Columns - Matching Row Layout */}
                <div className="flex w-full items-center justify-between">

                  {/* Left: Line & Destination */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-11 flex-shrink-0 flex justify-center items-center relative cursor-pointer hover:text-sky-200 transition-colors" onClick={toggleSort}>
                      <span>Linje</span>
                    </div>
                    <div className="flex-1 font-bold pl-1">Destination</div>
                  </div>

                  {/* Right: Time & Track */}
                  <div className="flex items-center gap-2 pl-2 text-right">
                    <div className="min-w-[3.5rem]">Tid</div>
                    <div className="w-14 text-center text-[10px] font-bold tracking-tight">NY TID</div>
                    <div className="w-8 md:w-9 text-center">Läge</div>
                  </div>
                </div>

                {/* Centered View Controls (Floating) - Modernized */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1 bg-sky-600/95 rounded-full px-2 py-0.5 shadow-lg backdrop-blur-sm border border-sky-400/30 ring-1 ring-black/5 z-20">
                  {/* Avg/Ank Toggles */}
                  <button
                    onClick={() => setViewMode('departures')}
                    className={`w-7 h-7 flex items-center justify-center rounded-full transition-all duration-300 ${viewMode === 'departures' ? 'bg-white text-sky-600 shadow-sm scale-105' : 'text-sky-200 hover:text-white hover:bg-sky-500/50'}`}
                    title="Avgångar"
                  >
                    <FontAwesomeIcon icon={faArrowUp} className={`text-sm ${viewMode === 'departures' ? 'rotate-45' : ''} transition-transform`} />
                  </button>
                  <button
                    onClick={() => setViewMode('arrivals')}
                    className={`w-7 h-7 flex items-center justify-center rounded-full transition-all duration-300 ${viewMode === 'arrivals' ? 'bg-white text-sky-600 shadow-sm scale-105' : 'text-sky-200 hover:text-white hover:bg-sky-500/50'}`}
                    title="Ankomster"
                  >
                    <FontAwesomeIcon icon={faArrowDown} className={`text-sm ${viewMode === 'arrivals' ? 'rotate-45' : ''} transition-transform`} />
                  </button>

                  <div className="w-[1px] h-3 bg-sky-400/40 mx-0.5"></div>

                  {/* Time Picker */}
                  <div className="relative flex items-center justify-center w-9 h-9 group">
                    <button className={`w-7 h-7 flex items-center justify-center rounded-full transition-all ${customTime ? 'bg-amber-400 text-amber-900 border border-amber-500 scale-105' : 'text-sky-200 group-hover:text-white group-hover:bg-sky-500/50'}`} title={customTime ? `Vald tid: ${new Date(customTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : "Välj tid"}>
                      <FontAwesomeIcon icon={faCalendarAlt} className="text-xs" />
                    </button>
                    <input
                      type="datetime-local"
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                      onChange={(e) => setCustomTime(e.target.value)}
                    />
                  </div>

                  {/* Min/Tid Toggle */}
                  <button
                    onClick={() => setTimeDisplayMode(timeDisplayMode === 'minutes' ? 'clock' : 'minutes')}
                    className={`w-7 h-7 flex items-center justify-center rounded-full transition-all ${timeDisplayMode === 'minutes' ? 'bg-white text-sky-600 shadow-sm scale-105' : 'text-sky-200 hover:text-white hover:bg-sky-500/50'}`}
                    title={timeDisplayMode === 'minutes' ? 'Byt till klocktid' : 'Byt till minuter'}
                  >
                    {timeDisplayMode === 'minutes' ? <span className="text-[9px] font-bold">MIN</span> : <FontAwesomeIcon icon={faClock} className="text-xs" />}
                  </button>

                  <div className="w-[1px] h-4 bg-sky-400/40 mx-1"></div>

                  {/* Zoom Toggle */}
                  <button
                    onClick={() => setIsDense(!isDense)}
                    className={`w-7 h-7 flex items-center justify-center rounded-full transition-all ${isDense ? 'bg-white text-sky-600 shadow-sm scale-105' : 'text-sky-200 hover:text-white hover:bg-sky-500/50'}`}
                    title={isDense ? "Zooma in" : "Zooma ut"}
                  >
                    <FontAwesomeIcon icon={isDense ? faSearchPlus : faSearchMinus} className="text-xs" />
                  </button>

                  <div className="w-[1px] h-3 bg-sky-400/40 mx-0.5"></div>

                  {/* Filter Toggle */}
                  <div className="relative">
                    <button
                      onClick={() => setShowFilterMenu(!showFilterMenu)}
                      className={`w-7 h-7 flex items-center justify-center rounded-full transition-all ${transportFilter !== 'all' ? 'bg-amber-400 text-amber-900 border border-amber-500 scale-105' : 'text-sky-200 hover:text-white hover:bg-sky-500/50'}`}
                      title="Filtrera trafikslag"
                    >
                      <FontAwesomeIcon icon={faFilter} className="text-xs" />
                    </button>

                    {showFilterMenu && (
                      <div className="absolute top-full right-0 mt-2 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-100 dark:border-slate-800 p-2 z-50 w-40 animate-in fade-in zoom-in-95">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-2">Visa</h4>
                        {[
                          { id: 'all', label: 'Alla', icon: null },
                          { id: 'BUS', label: 'Buss', icon: faBus },
                          { id: 'TRAM', label: 'Spårvagn', icon: faTram },
                          { id: 'TRAIN', label: 'Tåg', icon: faTrain },
                          { id: 'FERRY', label: 'Färja', icon: faShip }
                        ].map(opt => (
                          <button
                            key={opt.id}
                            onClick={() => { setTransportFilter(opt.id); setShowFilterMenu(false); }}
                            className={`w-full text-left px-2 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 ${transportFilter === opt.id ? 'bg-sky-50 text-sky-600 dark:bg-sky-900/20 dark:text-sky-400' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                          >
                            {opt.icon && <FontAwesomeIcon icon={opt.icon} className="w-4 text-center" />}
                            <span className={!opt.icon ? 'pl-6' : ''}>{opt.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                </div>

              </div>
            )
          }

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

                      const diff = dep.timestamp ? (new Date(dep.timestamp).getTime() - Date.now()) / 60000 : 0;
                      if (diff < -0.5) return null;

                      const minsRemaining = Math.ceil(diff);

                      // Legacy getDisplayTime removed. Logic moved to JSX.
                      const originalTime = dep.time;
                      const newTime = dep.realtime && dep.realtime !== dep.time ? dep.realtime : null;

                      // If close departure, HIDE scheduled time, show ONLY realtime in "Ny Tid" col
                      // If NOT close, show scheduled in "Tid", and realtime in "Ny Tid" ONLY if deviation

                      const isExpanded = expandedDepartureId === dep.id;
                      const expandedDetails = isExpanded ? journeyDetails : [];
                      const isExpandedLoading = isExpanded ? loadingDetails : false;

                      // Compact Row
                      return (
                        <div key={`${dep.id}-${idx}`} className="group/row">
                          <div
                            onClick={() => toggleDepartureExpand(dep)}
                            className={`relative ${isDense ? 'px-2 py-1' : 'px-3 py-2.5'} hover:bg-sky-50/40 dark:hover:bg-slate-800/60 transition-colors cursor-pointer group border-b border-slate-100 dark:border-slate-800/50 ${isCancelled ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}
                          >
                            <div className="flex items-center gap-3">
                              {/* Line Badge - Compact */}
                              <div className={`${isDense ? 'w-8' : 'w-10'} flex-shrink-0 flex justify-center`}>
                                <div
                                  className={`${isDense ? 'h-5 px-1 min-w-[1.5rem] text-[10px]' : 'h-6 px-1.5 min-w-[2rem] text-xs'} rounded flex items-center justify-center font-bold shadow-sm transition-transform group-hover:scale-105 ${isCancelled ? 'opacity-75' : ''}`}
                                  style={{
                                    backgroundColor: dep.bgColor || '#475569',
                                    color: dep.fgColor || '#ffffff'
                                  }}
                                >
                                  {dep.line}
                                </div>
                              </div>

                              {/* Destination & Disruption */}
                              <div className="flex-1 min-w-0 pr-2">
                                <div className="flex items-center gap-1.5">
                                  <span className={`${isDense ? 'text-xs' : 'text-sm'} font-bold truncate ${isCancelled ? 'text-red-700 dark:text-red-400 line-through decoration-red-500 decoration-2' : 'text-slate-900 dark:text-slate-100'}`}>
                                    {displayDirection}
                                  </span>
                                </div>
                              </div>

                              {/* Time & Track Columns */}
                              <div className="flex items-center gap-2 text-right justify-end ml-auto">
                                {/* TID (Scheduled or Mins) */}
                                <div className="w-12 flex flex-col items-end">
                                  <div className={`font-bold leading-none ${isDense ? 'text-xs' : 'text-sm'} ${isDeviation ? 'text-slate-400 dark:text-slate-500' + (isDense ? ' text-[10px]' : ' text-xs') : 'text-slate-900 dark:text-slate-100'}`}>
                                    {timeDisplayMode === 'minutes' ? (minsRemaining <= 0 ? "Nu" : `${minsRemaining} min`) : (isDeviation ? <span className="line-through">{originalTime}</span> : originalTime)}
                                  </div>
                                </div>

                                {/* NY TID (Realtime if deviation) */}
                                <div className={`w-12 font-bold ${isDense ? 'text-xs' : 'text-sm'} flex items-center justify-end ${isCancelled ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                  {isCancelled ? (
                                    <span className="text-[9px] uppercase font-black tracking-tight">Inställd</span>
                                  ) : (
                                    isDeviation && timeDisplayMode !== 'minutes' ? newTime : ''
                                  )}
                                </div>

                                {/* LÄGE (Track) */}
                                <div className={`w-10 font-bold ${isDense ? 'text-xs' : 'text-sm'} text-slate-600 dark:text-slate-300`}>
                                  {dep.track}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
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
      {/* Modal Overlay for Expanded Details */}
      {
        expandedDepartureId && (() => {
          const dep = departures.find(d => d.id === expandedDepartureId);
          if (!dep) return null;

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setExpandedDepartureId(null)}>
              <div onClick={e => e.stopPropagation()} className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-5 duration-300">

                {/* Modal Header */}
                <div className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 p-4 shrink-0 flex items-start justify-between">
                  <div className="flex items-start">
                    {/* Transport Icon Circle */}
                    <div className="w-10 h-10 rounded-full bg-sky-500 flex items-center justify-center text-white mr-3 shadow-md border border-sky-600 shrink-0 self-center">
                      {(() => {
                        const t = (dep.type || '').toUpperCase();
                        if (t.includes('TRAIN') || t.includes('TÅG')) return <FontAwesomeIcon icon={faTrain} />;
                        if (t.includes('TRAM') || t.includes('SPÅRVAGN')) return <FontAwesomeIcon icon={faTram} />;
                        if (t.includes('FERRY') || t.includes('BÅT')) return <FontAwesomeIcon icon={faShip} />;
                        if (t.includes('TAX') || t.includes('TAXI')) return <FontAwesomeIcon icon={faTaxi} />;
                        return <FontAwesomeIcon icon={faBus} />;
                      })()}
                    </div>

                    {/* Line Badge (Number Only - Simplified) */}
                    <div
                      className="h-10 px-3 min-w-[3rem] rounded-lg flex items-center justify-center font-bold text-xl shadow-sm mr-3 border-2 shrink-0 self-center"
                      style={{
                        backgroundColor: dep.bgColor || '#0ea5e9',
                        color: dep.fgColor || '#ffffff',
                        borderColor: dep.fgColor || 'transparent'
                      }}
                    >
                      {dep.line}
                    </div>

                    <div className="flex flex-col min-w-0">
                      <div className="font-bold text-lg leading-tight flex items-center gap-2 truncate">
                        {mode === 'arrivals' ? <span className="text-sm font-normal text-slate-500 uppercase">Från</span> : null}
                        {dep.direction}
                        {!mode && <FontAwesomeIcon icon={faChevronRight} className="text-slate-300 text-xs shrink-0" />}
                      </div>
                      <div className="flex flex-col mt-1">
                        <div className="text-base font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2 whitespace-nowrap">
                          {dep.track && (
                            <div className="flex items-center gap-1.5 opacity-100">
                              <FontAwesomeIcon icon={faMapMarkerAlt} className="text-slate-400 text-xs" />
                              <span className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-1.5 py-0.5 rounded text-sm font-bold border border-slate-300 dark:border-slate-700 inline-flex items-center gap-1.5 align-middle shadow-sm">
                                <span className="bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-1 rounded-[3px] text-[9px] uppercase font-black tracking-wider leading-tight py-[2px]">
                                  {(() => {
                                    const t = (dep.type || '').toUpperCase();
                                    return (t.includes('TRAIN') || t.includes('TÅG')) ? 'SPÅR' : 'LÄGE';
                                  })()}
                                </span>
                                {dep.track}
                              </span>
                            </div>
                          )}
                          <span className="font-mono tracking-tight text-xl ml-1">
                            {new Date(dep.timestamp).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        {/* Next Stop Logic */}
                        {(() => {
                          // Check if trip hasn't started
                          const firstStop = journeyDetails[0];
                          const now = Date.now();

                          // Helper to get time
                          const getT = (s: any) => getMs(s?.realtimeDeparture || s?.departureTime || s?.time);

                          if (firstStop) {
                            const startT = getT(firstStop);
                            if (startT && startT > now + 60000) { // 1 min buffer
                              const diffMins = Math.ceil((startT - now) / 60000);
                              return (
                                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mt-1">
                                  <FontAwesomeIcon icon={faClock} />
                                  Turen har ej startat ännu! Avgår om {diffMins} min.
                                </div>
                              )
                            }
                          }

                          if (nextStop && nextStop.name !== dep.direction) {
                            return (
                              <div className="text-xs font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider flex items-center gap-1.5 mt-1">
                                <span className="text-base leading-none">•</span>
                                NÄSTA: {nextStop.name}
                                {nextStop.track && (
                                  <span className="ml-1.5 text-[9px] font-bold bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 px-1.5 py-0.5 rounded border border-sky-200 dark:border-sky-800/50">
                                    {nextStop.track}
                                  </span>
                                )}
                              </div>
                            )
                          }
                          return null;
                        })()}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => { setExpandedDepartureId(null); setNextStop(null); }} className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500">
                    <FontAwesomeIcon icon={faTimes} className="text-lg" />
                  </button>
                </div>

                {/* Action Bar */}
                <div className="p-4 bg-slate-50 dark:bg-slate-950/50 border-b border-slate-100 dark:border-slate-800 shrink-0 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      {detailsUpdatedAt && `Uppdaterad ${detailsUpdatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                    </div>
                    <div className="flex gap-2">
                      {/* Map Toggle Button (Moved here) */}
                      {journeyDetails.length > 0 && journeyDetails.some(d => d.coords) && (
                        <button
                          onClick={() => setShowRouteMap(!showRouteMap)}
                          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all border ${showRouteMap
                            ? 'bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-800'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                            }`}
                          title="Visa karta"
                        >
                          <FontAwesomeIcon icon={faMap} />
                        </button>
                      )}


                      <button
                        onClick={() => {
                          let arrivalTime: string | undefined;
                          const lastStop = journeyDetails[journeyDetails.length - 1];
                          if (lastStop) {
                            arrivalTime = lastStop.realtimeArrival || lastStop.arrivalTime || lastStop.time;
                            if (arrivalTime && !arrivalTime.includes('T')) {
                              try {
                                const [h, m] = arrivalTime.split(':');
                                const arrivalDate = new Date(dep.timestamp);
                                arrivalDate.setHours(parseInt(h), parseInt(m));
                                if (arrivalDate.getTime() < new Date(dep.timestamp).getTime()) {
                                  arrivalDate.setDate(arrivalDate.getDate() + 1);
                                }
                                arrivalTime = arrivalDate.toISOString();
                              } catch (e) { }
                            }
                          }

                          const alarmId = `${dep.id}-${Date.now()}`;
                          const dueTime = new Date(dep.timestamp);
                          dueTime.setMinutes(dueTime.getMinutes() - 5);

                          addAlarm({
                            id: alarmId,
                            departureTime: dep.timestamp,
                            dueTime: dueTime.getTime(),
                            stationName: station?.name || 'Okänd hållplats',
                            line: dep.line,
                            direction: dep.direction,
                            journeyRef: dep.journeyRef,
                            arrivalTime: arrivalTime
                          });
                          toast.success(`Larm satt!`, `Du får notis 5 min innan avgång.`);
                        }}
                        className="bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-full text-xs font-bold shadow-sm flex items-center gap-2 transition-transform active:scale-95 ml-auto"
                      >
                        <FontAwesomeIcon icon={faClock} />
                        Bevaka
                      </button>
                    </div>
                  </div>

                  {/* Disruption Alert moved out of flex row */}
                  {((dep.hasDisruption && dep.disruptionMessage) || (specificDisruptions && specificDisruptions.length > 0)) && (
                    <div className={`p-3 rounded-xl border flex gap-3 items-start ${(specificDisruptions?.some(d => d.severity === 'severe') || (!specificDisruptions && dep.disruptionSeverity === 'severe'))
                      ? 'bg-red-50 border-red-100 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200'
                      : 'bg-amber-50 border-amber-100 text-amber-800 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-200'
                      }`}>
                      <FontAwesomeIcon icon={faExclamationTriangle} className="text-base mt-0.5 shrink-0" />
                      <div className="flex flex-col gap-1 min-w-0">
                        {specificDisruptions && specificDisruptions.length > 0 ? (
                          specificDisruptions.map((d, i) => (
                            <div key={i}>
                              <div className="text-xs font-bold">{d.title}</div>
                              <div className="text-[11px] opacity-90 leading-snug">{d.description}</div>
                            </div>
                          ))
                        ) : (
                          <div className="text-xs font-medium leading-snug">
                            {dep.disruptionMessage}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-4 bg-white dark:bg-slate-900 min-h-[300px]">
                  {showRouteMap && (
                    <div className="mb-6 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 h-48 bg-slate-100 relative shrink-0">
                      <DepartureRouteMap
                        stops={journeyDetails}
                        color={dep.bgColor}
                      />
                    </div>
                  )}

                  {loadingDetails ? (
                    <div className="flex justify-center py-12">
                      <ThemedSpinner size={32} />
                    </div>
                  ) : (
                    <div className="pb-8">
                      <JourneyTimeline
                        stops={journeyDetails}
                        type={dep.type}
                        currentStationName={station?.name}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()
      }
    </div >
  );
};
