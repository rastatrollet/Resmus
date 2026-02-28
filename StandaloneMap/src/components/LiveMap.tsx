import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, CircleMarker } from 'react-leaflet';
import { AnimatedMarker } from './AnimatedMarker';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { GtfsShapeService, type VehicleRoutePayload } from '../services/gtfsShapeService';
import { TRAFIKLAB_OPERATORS } from '../services/config';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBus, faTrain, faTram, faChevronDown, faLocationArrow, faXmark, faExpand, faCompress, faShip, faMoon, faSun, faSpinner, faSatellite, faSliders } from '@fortawesome/free-solid-svg-icons';

const REFRESH_INTERVAL = 10000; // 10 seconds – snappier updates

// ── Icon cache: keyed by "MODE|color|bearingBucket|line"
// ── Modern 2026 Icon System ──────────────────────────────────────────────────
// Vector-based, crisp, glass-morphic markers with distinct shapes per mode.

const iconCache = new Map<string, L.DivIcon>();

const buildIconHTML = (line: string, rotation: number, mode: string, color: string): string => {
    const bgColor = color || '#0ea5e9';
    let vehicleShape = '';

    if (mode === 'FERRY') {
        vehicleShape = `
            <path d="M 24 2 C 32 10 36 22 36 38 A 12 4 0 0 1 12 38 C 12 22 16 10 24 2 Z" fill="${bgColor}" stroke="#ffffff" stroke-width="1.5" />
            <rect x="20" y="16" width="8" height="12" rx="2" fill="#1e293b" opacity="0.8" />
        `;
    } else if (mode === 'TRAIN') {
        vehicleShape = `
            <path d="M 14 10 C 14 2 34 2 34 10 L 34 46 L 14 46 Z" fill="${bgColor}" stroke="#ffffff" stroke-width="1.5" />
            <path d="M 16 12 C 16 6 32 6 32 12 L 30 16 L 18 16 Z" fill="#1e293b" opacity="0.8" />
            <rect x="16" y="44" width="16" height="4" fill="#1e293b" opacity="0.8" />
        `;
    } else if (mode === 'TRAM') {
        vehicleShape = `
            <rect x="14" y="2" width="20" height="44" rx="4" fill="${bgColor}" stroke="#ffffff" stroke-width="1.5" />
            <path d="M 16 8 C 16 4 32 4 32 8 L 31 11 L 17 11 Z" fill="#1e293b" opacity="0.8" />
            <path d="M 16 40 C 16 44 32 44 32 40 L 31 37 L 17 37 Z" fill="#1e293b" opacity="0.8" />
            <rect x="16" y="22" width="16" height="4" fill="#1e293b" opacity="0.4" />
        `;
    } else {
        // BUS
        vehicleShape = `
            <rect x="12" y="4" width="24" height="40" rx="5" fill="${bgColor}" stroke="#ffffff" stroke-width="1.5" />
            <!-- Windshield -->
            <path d="M 14 10 C 14 6 34 6 34 10 L 33 14 L 15 14 Z" fill="#1e293b" opacity="0.85" />
            <!-- Rear window -->
            <rect x="16" y="41" width="16" height="2" rx="1" fill="#1e293b" opacity="0.8" />
            <!-- Roof hatch/AC -->
            <rect x="19" y="18" width="10" height="12" rx="1" fill="#000000" opacity="0.15" />
            <!-- Side mirrors -->
            <rect x="9" y="8" width="3" height="5" rx="1.5" fill="#1e293b" />
            <rect x="36" y="8" width="3" height="5" rx="1.5" fill="#1e293b" />
        `;
    }

    // Vehicle rotates, but the white badge holding the text remains upright.
    return `<div style="width:48px; height:48px; position:relative; display:flex; align-items:center; justify-content:center; filter:drop-shadow(0px 3px 5px rgba(0,0,0,0.3)); transform: translate3d(0,0,0);">
        <!-- Rotating Vehicle Body -->
        <div style="position:absolute; inset:0; transform:rotate(${rotation}deg); will-change:transform; display:flex; align-items:center; justify-content:center;">
            <svg viewBox="0 0 48 48" width="48" height="48">
                ${vehicleShape}
            </svg>
        </div>

        <!-- Static Center Box for Line Number -->
        <div style="position:absolute; z-index:10; display:flex; align-items:center; justify-content:center; width:100%; height:100%;">
            <span style="font-size:11px; font-weight:900; color:#1e293b; background-color:rgba(255,255,255,0.95); padding:2px 5px; border-radius:5px; font-family:sans-serif; letter-spacing:-0.5px; box-shadow:0px 1px 3px rgba(0,0,0,0.3); border:1px solid rgba(0,0,0,0.1); line-height: 1;">${line}</span>
        </div>
    </div>`;
};


const getIcon = (line: string, bearing: number, mode: string, color: string): L.DivIcon => {
    const bucket = Math.round(bearing / 5) * 5;
    const key = `${mode}|${color}|${bucket}|${line}`;
    if (iconCache.has(key)) return iconCache.get(key)!;
    const icon = L.divIcon({
        html: buildIconHTML(line, bucket, mode, color),
        className: 'bg-transparent border-0',
        iconSize: [48, 48],
        iconAnchor: [24, 24],
    });
    iconCache.set(key, icon);
    return icon;
};

// ── Helper: Create Optimistic Route Stub (75m - short enough to look valid on curves)
const createRouteStub = (lat: number, lng: number, bearing: number): [number, number][] => {
    if (!bearing) return [];
    const R = 6378137; // Earth Radius
    const d = 75; // 75m stub (reduced from 300m)
    const brng = (bearing * Math.PI) / 180;
    const lat1 = (lat * Math.PI) / 180;
    const lon1 = (lng * Math.PI) / 180;

    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d / R) + Math.cos(lat1) * Math.sin(d / R) * Math.cos(brng));
    const lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(d / R) * Math.cos(lat1), Math.cos(d / R) - Math.sin(lat1) * Math.sin(lat2));

    return [
        [lat, lng],
        [(lat2 * 180) / Math.PI, (lon2 * 180) / Math.PI]
    ];
};

// ── Compact Glass Panel Model
interface Chip { label: string; value: string; color?: string; }
interface CompactPanel {
    title: string;         // "Mot DESTINATION"
    subtitle: string;      // "Nästa: ..."
    lineNumber: string;
    lineColor: string;
    chips: Chip[];
}

const formatCompactPanel = (
    v: any,
    routeInfo: any,
    tripHeadsign: string | null | undefined,
    nextStopName: string | null,
    gtfsLoading: boolean,
    defaultColor: string,
    syncLine?: string,
    syncDest?: string
): CompactPanel => {
    const lineDisplay = gtfsLoading ? (syncLine || v.line || '?') : (routeInfo?.shortName || syncLine || v.line || '?');

    let dest = tripHeadsign || syncDest || routeInfo?.longName || v.dest;

    // Prevent fallback resulting in showing line number as destination (e.g., "Mot 3")
    if (dest === lineDisplay || dest === v.line) {
        dest = '';
    }

    let title = '';

    // "EJ I TRAFIK" logic: Only if destination explicitly matches patterns, or no line AND no dest.
    const isExplicitlyNotInService = dest && /Ej i trafik|Depå|Inställd|Ej linjesatt/i.test(dest);

    if (isExplicitlyNotInService) {
        title = 'EJ I TRAFIK';
    } else if (!dest || dest === '?') {
        title = 'Okänd destination';
    } else {
        title = `Mot ${dest}`;
    }

    // Clean up next stop formatting
    let next = 'Ej angiven hållplats';
    if (nextStopName) {
        next = `Nästa: ${nextStopName}`;
    } else if (v.stopId) {
        next = `Hållplats-ID: ${v.stopId}`;
    }

    const chips: Chip[] = [];

    // Speed
    if (v.speed !== undefined && v.speed !== null) {
        chips.push({ label: 'hastighet', value: `${Math.round(v.speed)} km/h` });
    } else {
        chips.push({ label: 'hastighet', value: `0 km/h` });
    }

    let rawId = v.vehicleLabel || String(v.id || '').replace(/^(tl-|vt-|veh-)/, '');
    if (rawId && rawId !== 'unknown') {
        chips.push({ label: 'fordons-id', value: rawId });
    }

    // Track stationary / stale vehicles (> 30 minutes without a position update)
    if (v.timestamp) {
        const timeDiffSeconds = (Date.now() / 1000) - v.timestamp;
        if (timeDiffSeconds > 1800) { // 30 mins
            const date = new Date(v.timestamp * 1000);
            chips.push({
                label: 'senast uppdaterad',
                value: date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
            });
        }
    }

    return {
        title: title,
        subtitle: title === 'EJ I TRAFIK' ? 'Ej linjesatt' : next,
        lineNumber: lineDisplay,
        lineColor: routeInfo?.color || defaultColor,
        chips
    };
};

// ── Memoized Vehicle Marker
const VehicleMarker = React.memo(({ v, onSelect, simpleMode, lineOverride, titleOverride, colorOverride, typeOverride }:
    { v: any, onSelect: (v: any) => void, simpleMode: boolean, showLabels?: boolean, lineOverride?: string, titleOverride?: string, colorOverride?: string, typeOverride?: number }) => {
    // Determine label: either line number (resolved) or just '?'
    const lineLabel = lineOverride || v.line || '?';

    // Resolve mode based on typeOverride (GTFS route_type) or fallback
    let mode = v.transportMode ?? 'BUS';
    if (typeOverride !== undefined) {
        switch (typeOverride) {
            case 0: mode = 'TRAM'; break;
            case 1:
            case 2:
            case 109: mode = 'TRAIN'; break;
            case 3:
            case 700: mode = 'BUS'; break;
            case 4:
            case 1000: mode = 'FERRY'; break;
        }
    }

    const color = colorOverride || v.bgColor || (mode === 'TRAM' ? '#14b8a6' : '#0ea5e9');

    // For simple mode (dots), keep it fast
    if (simpleMode) {
        return (
            <CircleMarker
                center={[v.lat, v.lng]}
                radius={3}
                pathOptions={{ fillColor: color, color: '#fff', weight: 1, opacity: 0.8, fillOpacity: 1 }}
                eventHandlers={{ click: () => onSelect(v) }}
            >
                {titleOverride && <Popup>{titleOverride}</Popup>}
            </CircleMarker>
        );
    }

    return (
        <AnimatedMarker
            position={[v.lat, v.lng]}
            icon={getIcon(lineLabel, v.bearing ?? 0, mode, color)}
            eventHandlers={{ click: () => onSelect(v) }}
            title={titleOverride || `Linje ${lineLabel}`}
            speed={v.speed}
            bearing={v.bearing ?? 0}
        />
    );
}, (prev, next) =>
    prev.v.id === next.v.id &&
    prev.v.lat === next.v.lat &&
    prev.v.lng === next.v.lng &&
    prev.v.bearing === next.v.bearing &&
    prev.simpleMode === next.simpleMode &&
    prev.lineOverride === next.lineOverride &&
    prev.titleOverride === next.titleOverride &&
    prev.colorOverride === next.colorOverride
);

// ── Map Events Controller
import { MapService } from '../services/mapService';

// ── Map Events Controller
const MapEvents = ({ setVehicles, setStops, setDisruptions, selectedOperator, setZoom, setIsLoading }: {
    setVehicles: (v: any[]) => void,
    setStops: (s: any[]) => void,
    setDisruptions: (d: any[]) => void,
    selectedOperator?: string,
    setZoom: (z: number) => void,
    setIsLoading: (l: boolean) => void
}) => {
    const map = useMap();
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const fetchCountRef = useRef(0);

    useEffect(() => {
        if (selectedOperator) {
            setVehicles([]);
            const op = TRAFIKLAB_OPERATORS.find(o => o.id === selectedOperator);
            if (op && op.lat && op.lng) map.setView([op.lat, op.lng], 9);
        }
    }, [selectedOperator, map]);

    // ── Smart Regional Preloading ──────────────────────────────────────────────
    // Automatically load static GTFS for the region in view to ensure lines/destinations appear.
    useEffect(() => {
        const checkRegion = () => {
            const center = map.getCenter();
            const lat = center.lat;
            const lng = center.lng;

            // Simple bbox checks for major regions to trigger preload
            // This ensures that if user pans to Örebro, we load 'orebro' GTFS.
            if (lat > 59.0 && lat < 59.5 && lng > 14.5 && lng < 15.8) GtfsShapeService.preload('orebro');
            if (lat > 59.2 && lat < 60.0 && lng > 16.0 && lng < 17.0) GtfsShapeService.preload('vastmanland');
            if (lat > 59.1 && lat < 60.0 && lng > 13.0 && lng < 14.2) GtfsShapeService.preload('varm'); // Värmland
            if (lat > 58.2 && lat < 58.6 && lng > 14.9 && lng < 16.5) GtfsShapeService.preload('otraf'); // Östgöta
            if (lat > 60.3 && lat < 61.0 && lng > 14.5 && lng < 16.5) GtfsShapeService.preload('dt'); // Dalarna
            if (lat > 56.3 && lat < 57.6 && lng > 11.8 && lng < 13.5) GtfsShapeService.preload('halland');
            if (lat > 55.4 && lat < 56.5 && lng > 12.5 && lng < 14.5) GtfsShapeService.preload('skane');
            if (lat > 58.8 && lat < 59.8 && lng > 17.5 && lng < 19.0) GtfsShapeService.preload('sl');
            if (lat > 57.0 && lat < 58.5 && lng > 11.5 && lng < 13.5) GtfsShapeService.preload('vasttrafik');

            // Add more as needed...
        };

        map.on('moveend', checkRegion);
        checkRegion(); // Initial check

        return () => {
            map.off('moveend', checkRegion);
        };
    }, [map]);

    const fetchMapData = async () => {
        setIsLoading(true);
        const bounds = map.getBounds();
        const zoom = map.getZoom();
        setZoom(zoom);
        fetchCountRef.current++;

        try {
            if (zoom > 8) {
                // Use MapService
                const vehicleData = await MapService.getVehiclePositions(
                    bounds.getSouth(), bounds.getWest(), bounds.getNorth(), bounds.getEast(), selectedOperator
                );
                setVehicles(vehicleData || []);

                // Fetch stops if zoomed in
                if (zoom > 14) {
                    // Gather GTFS stops for all loaded operators in the view
                    let stopData: any[] = [];
                    for (const opObj of TRAFIKLAB_OPERATORS) {
                        if (GtfsShapeService.isLoaded(opObj.id)) {
                            const parsedStops = GtfsShapeService.getAllStops(
                                opObj.id, bounds.getSouth(), bounds.getWest(), bounds.getNorth(), bounds.getEast()
                            );
                            if (parsedStops && parsedStops.length > 0) {
                                // Filter out invalid coordinates to prevent Leaflet NaN errors
                                stopData = stopData.concat(parsedStops.filter((s: any) => s.lat != null && !isNaN(s.lat) && s.lng != null && !isNaN(s.lng)));
                            }
                        }
                    }

                    // Fallback to Västtrafik StopAreas if no GTFS static is loaded yet
                    if (stopData.length === 0) {
                        stopData = await MapService.getMapStopAreas(
                            bounds.getSouth(), bounds.getWest(), bounds.getNorth(), bounds.getEast()
                        );
                    }
                    setStops(stopData);
                } else {
                    setStops([]);
                }

                // Parkings
                /*
                if (zoom > 13) {
                     const parkingData = await MapService.getParkings(
                         bounds.getSouth(), bounds.getWest(), bounds.getNorth(), bounds.getEast()
                     );
                     setParkings(parkingData || []);
                }
                */
            }
            // Disruptions only every ~60s (every 6th call)
            if (fetchCountRef.current % 6 === 1) {
                const disruptions = await MapService.getDisruptions();
                setDisruptions(disruptions || []);
            }
        } catch (e) {
            console.error('Map Data Fetch Error', e);
        } finally {
            setIsLoading(false);
        }
    };

    const debouncedFetch = () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(fetchMapData, 800);
    };

    useEffect(() => {
        let isActive = true;
        let timerId: ReturnType<typeof setTimeout>;

        const loop = async () => {
            if (!isActive) return;
            await fetchMapData();
            if (isActive) {
                timerId = setTimeout(loop, REFRESH_INTERVAL);
            }
        };

        loop();
        map.on('moveend', debouncedFetch);
        return () => {
            isActive = false;
            clearTimeout(timerId);
            if (debounceRef.current) clearTimeout(debounceRef.current);
            map.off('moveend', debouncedFetch);
        };
    }, [map, selectedOperator]);

    return null;
};

// ── Main LiveMap Component
export const LiveMap = () => {
    const [vehicles, setVehicles] = useState<any[]>([]);
    const [stops, setStops] = useState<any[]>([]);
    // Removed setParkings unused
    const [disruptions, setDisruptions] = useState<any[]>([]);
    const [selectedOperator, setSelectedOperator] = useState<string>('sweden');

    const [zoom, setZoom] = useState<number>(13);
    const [activeFilters, setActiveFilters] = useState<string[]>(['BUS', 'TRAM', 'TRAIN', 'FERRY']);
    const [hideDepot, setHideDepot] = useState(true);
    const [showLabels, setShowLabels] = useState(false); // Toggle for showing vehicle IDs
    const [isSatellite, setIsSatellite] = useState(false);
    const [showLayers, setShowLayers] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
    const [selectedVehicle, setSelectedVehicle] = useState<any | null>(null);
    const [journeyPath, setJourneyPath] = useState<[number, number][]>([]);
    const [journeyStops, setJourneyStops] = useState<any[]>([]);
    const [gtfsPayload, setGtfsPayload] = useState<VehicleRoutePayload | null>(null);
    const [gtfsLoading, setGtfsLoading] = useState(false);
    const [gtfsRouteMaps, setGtfsRouteMaps] = useState<Record<string, Map<string, string>>>({});

    // Sync dark mode with html class
    useEffect(() => {
        const observer = new MutationObserver(() => {
            setIsDark(document.documentElement.classList.contains('dark'));
        });
        observer.observe(document.documentElement, { attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);

    // Aggressive GTFS Preloading ────────────────────────
    useEffect(() => {
        if (vehicles.length === 0) return;

        const operators = Array.from(new Set(vehicles.map(v => v.operator || 'vasttrafik')));

        // 1. Trigger preload
        operators.forEach(op => {
            GtfsShapeService.preload(op).catch(err =>
                console.warn(`[LiveMap] Background preload failed for ${op}`, err)
            );
        });

        // 2. Poll for route maps (so line numbers appear ASAP)
        const checkMaps = () => {
            setGtfsRouteMaps(prev => {
                const next = { ...prev };
                let changed = false;
                operators.forEach(op => {
                    if (!next[op]) {
                        const m = GtfsShapeService.getRouteMap(op);
                        if (m && m.size > 0) {
                            next[op] = m;
                            changed = true;
                        }
                    }
                });
                return changed ? next : prev;
            });
        };

        const poller = setInterval(checkMaps, 1000); // Check every second until loaded
        checkMaps(); // Check immediately

        return () => clearInterval(poller);
    }, [vehicles]); // Re-run when vehicle list updates

    // Keep selected vehicle updated with fresh data
    useEffect(() => {
        if (selectedVehicle && vehicles.length > 0) {
            const updatedVehicle = vehicles.find(v => v.id === selectedVehicle.id);
            if (updatedVehicle) {
                // Check if speed, lat/lng, or stopSequence changed
                const hasSignificantChange =
                    updatedVehicle.lat !== selectedVehicle.lat ||
                    updatedVehicle.lng !== selectedVehicle.lng ||
                    updatedVehicle.stopSequence !== selectedVehicle.stopSequence;

                if (hasSignificantChange) {
                    setSelectedVehicle(updatedVehicle);
                    const op = updatedVehicle.operator || 'vasttrafik';
                    if (GtfsShapeService.isLoaded(op)) {
                        const syncPayload = GtfsShapeService.resolveSync(
                            updatedVehicle.tripId, updatedVehicle.routeId, op,
                            updatedVehicle.stopId, updatedVehicle.dest,
                            updatedVehicle.stopSequence, updatedVehicle.lat, updatedVehicle.lng
                        );
                        if (syncPayload) {
                            setGtfsPayload(syncPayload);
                        }
                    }
                }
            }
        }
    }, [vehicles, selectedVehicle]);

    const toggleDark = () => {

        const next = !document.documentElement.classList.contains('dark');
        if (next) document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', next ? 'dark' : 'light');
    };

    const toggleFilter = (mode: string) => {
        setActiveFilters(prev => prev.includes(mode) ? prev.filter(m => m !== mode) : [...prev, mode]);
    };

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().then(() => setIsFullscreen(true));
        } else {
            document.exitFullscreen().then(() => setIsFullscreen(false));
        }
    };

    const handleSelectVehicle = async (v: any) => {
        setSelectedVehicle(v);
        // Optimistic stub: Draw projected path immediately
        setJourneyPath(createRouteStub(v.lat, v.lng, v.bearing ?? 0));
        setJourneyStops([]);
        setGtfsPayload(null);
        setGtfsLoading(false);

        // ── Path A: Västtrafik V4 logic removed ──
        // Users requested total decoupling from Västtrafik API for the map service.
        // We now rely 100% on GTFS-RT + GTFS Static for shape and route info.


        // ── Path B: GTFS-RT (tripId / routeId) → static GTFS shape + route info ─
        if (v.tripId || v.routeId) {
            const op = v.operator || 'vasttrafik'; // Default to VT for GTFS matching

            let hasSyncData = false;
            // Try to resolve synchronously first to avoid UI jumps/spinners
            if (GtfsShapeService.isLoaded(op)) {
                const syncPayload = GtfsShapeService.resolveSync(v.tripId, v.routeId, op, v.stopId, v.dest, v.stopSequence, v.lat, v.lng);
                if (syncPayload) {
                    setGtfsPayload(syncPayload);
                    hasSyncData = true; // We have data, no need to show spinner

                    if (syncPayload.shape && syncPayload.shape.coordinates.length >= 2) {
                        setJourneyPath(syncPayload.shape.coordinates);
                    }
                    if (syncPayload.journeyStops) {
                        setJourneyStops(syncPayload.journeyStops);
                    }
                }
            }

            // Only show loading spinner if we didn't resolve anything synchronously
            if (!hasSyncData) {
                setGtfsLoading(true);
            }

            // Still do async to catch any deferred shapes or if not loaded
            try {
                // Map operator to GTFS static operator id
                // Trafiklab static uses e.g. 'vasttrafik', 'sl', 'skane'
                // Trafiklab static uses e.g. 'vasttrafik', 'sl', 'skane'
                const op = v.operator || 'vasttrafik'; // Default to VT for GTFS matching
                const payload = await GtfsShapeService.resolve(v.tripId, v.routeId, op, v.stopId, v.dest, v.stopSequence, v.lat, v.lng);

                setGtfsPayload(payload);

                if (payload.shape && payload.shape.coordinates.length >= 2) {
                    setJourneyPath(payload.shape.coordinates);
                }
                if (payload.resolutionNotes.length > 0) {
                    console.log('[GtfsShape] Notes:', payload.resolutionNotes);
                }
            } catch (e) {
                console.error('Failed to load GTFS shape', e);
            } finally {
                setGtfsLoading(false);
            }
        }
    };

    const position: [number, number] = [57.70887, 11.97456];
    // Prefer GTFS route_color if available, else fall back to mode color
    const journeyColor = gtfsPayload?.routeInfo?.color
        || (selectedVehicle?.transportMode === 'TRAM' ? '#14b8a6'
            : selectedVehicle?.transportMode === 'TRAIN' ? '#d946ef'
                : selectedVehicle?.transportMode === 'FERRY' ? '#6366f1'
                    : '#0ea5e9');

    return (
        <div className="w-full h-[100dvh] md:h-full relative z-0 bg-slate-100 dark:bg-slate-900">
            <MapContainer
                center={position}
                zoom={13}
                style={{ height: '100%', width: '100%' }}
                zoomControl={false}
                preferCanvas={true}
            >
                <TileLayer
                    key={isSatellite ? 'sat' : (isDark ? 'dark' : 'light')}
                    url={isSatellite
                        ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
                        : (isDark
                            ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
                            : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png')
                    }
                    attribution={isSatellite
                        ? 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                        : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'}
                    maxZoom={20}
                />

                <MapEvents
                    setVehicles={setVehicles}
                    setStops={setStops}
                    setDisruptions={setDisruptions}
                    selectedOperator={selectedOperator}
                    setZoom={setZoom}
                    setIsLoading={setIsLoading}
                />

                {/* Journey Path */}
                {journeyPath.length > 0 && (
                    <>
                        <Polyline
                            positions={journeyPath}
                            pathOptions={{ color: journeyColor, weight: 5, opacity: 0.65, lineCap: 'round' }}
                        />
                        {journeyStops.map((stop, idx) => (
                            <CircleMarker
                                key={`js-${idx}`}
                                center={[stop.coords.lat, stop.coords.lng]}
                                radius={4}
                                pathOptions={{ fillColor: '#fff', color: journeyColor, weight: 2, fillOpacity: 1 }}
                            >
                                <Popup closeButton={false}>
                                    <div className="text-center font-sans">
                                        <div className="font-bold text-xs">{stop.name}</div>
                                        <div className="text-[10px] text-slate-500">{stop.time}</div>
                                    </div>
                                </Popup>
                            </CircleMarker>
                        ))}
                    </>
                )}

                {stops.filter(s => s && s.lat != null && !isNaN(s.lat) && s.lng != null && !isNaN(s.lng)).map(s => (
                    <Marker
                        key={s.id}
                        position={[s.lat, s.lng]}
                        icon={L.divIcon({
                            className: 'bg-transparent',
                            html: s.platformCode ? `<div class="w-5 h-5 bg-white border border-slate-400 rounded-full flex items-center justify-center text-[9px] font-bold text-slate-800 shadow-sm leading-none">${s.platformCode}</div>` : `<div class="w-3 h-3 bg-white border-2 border-slate-400 rounded-full shadow-sm"></div>`,
                            iconSize: s.platformCode ? [20, 20] : [12, 12],
                            iconAnchor: s.platformCode ? [10, 10] : [6, 6]
                        })}
                    >
                        <Popup><div className="font-sans text-sm font-bold text-slate-700">{s.name} {s.platformCode ? `<span class="text-xs text-slate-500 block">(Läge ${s.platformCode})</span>` : ''}</div></Popup>
                    </Marker>
                ))}

                {/* Vehicles */}
                {vehicles
                    .filter(v => activeFilters.includes(v.transportMode || 'BUS'))
                    .filter(v => {
                        if (!hideDepot) return true;

                        const isDepot = (v.dest && /Ej i trafik|Depå|Inställd/i.test(v.dest));

                        // Relaxed logic: Show '?' lines unless they are explicitly depot/out of service
                        // We only consider it "invalid" if it has NO line info AND no route info AND is likely a ghost
                        const noLine = !v.line || v.line === ''; // Allow '?'
                        const noRoute = !v.routeId && !v.detailsReference;

                        if (isDepot) return false;
                        return !(noLine && noRoute);
                    })
                    .map(v => {
                        const op = v.operator || 'vasttrafik';
                        // Resolve line info synchronously (fast) using cached routes/trips
                        // This handles cases where we only have tripId, or routeId is a long string
                        const info = GtfsShapeService.getLineInfo(op, v.tripId, v.routeId);

                        let resolvedLine = info?.line || v.line;

                        // User toggle: display last 4 digits of hardware ID instead of line number
                        if (showLabels) {
                            let rawId = v.vehicleLabel || String(v.id || '').replace(/^(tl-|vt-|veh-)/, '');
                            if (rawId && rawId !== 'unknown') {
                                // Extract the last 4 characters
                                resolvedLine = rawId.slice(-4);
                            } else {
                                resolvedLine = 'ID?';
                            }
                        }

                        // Use header sign from GTFS if available (since Realtime PBF often misses it)
                        const resolvedHeadsign = info?.headsign || v.dest || (resolvedLine && resolvedLine !== '?' ? `Linje ${resolvedLine}` : null);

                        return (
                            <VehicleMarker
                                key={v.id}
                                v={v}
                                onSelect={handleSelectVehicle}
                                simpleMode={vehicles.length > 200 || zoom < 13}
                                showLabels={showLabels}
                                lineOverride={resolvedLine}
                                titleOverride={resolvedHeadsign}
                                colorOverride={info?.color}
                                typeOverride={info?.routeType}
                            />
                        );
                    })}

                {/* Disruptions */}
                {disruptions.map(d =>
                    d.coordinates?.length > 0 && d.coordinates.map((coord: any, idx: number) => (
                        <Marker
                            key={`dis-${d.id}-${idx}`}
                            position={[coord.lat, coord.lng]}
                            icon={L.divIcon({
                                className: 'bg-transparent',
                                html: `<div class="w-8 h-8 bg-amber-500 rounded-full shadow-lg border-2 border-white flex items-center justify-center text-white animate-pulse"><svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg></div>`,
                                iconSize: [32, 32],
                                iconAnchor: [16, 32]
                            })}
                        >
                            <Popup>
                                <div className="max-w-xs">
                                    <h3 className="font-bold text-sm mb-1">{d.title}</h3>
                                    <p className="text-xs text-slate-600 mb-2">{d.description}</p>
                                    <div className="text-[10px] text-slate-400 font-mono">
                                        Start: {d.startTime ? new Date(d.startTime).toLocaleString() : '-'}
                                    </div>
                                </div>
                            </Popup>
                        </Marker>
                    ))
                )}
                    // Vehicles map... ends above

                {/* ── Selected Vehicle Panel (As Popup) ── */}
                {selectedVehicle && (() => {
                    const op = selectedVehicle.operator || 'vasttrafik';
                    const syncInfo = GtfsShapeService.getLineInfo(op, selectedVehicle.tripId, selectedVehicle.routeId);

                    const formattedNextStop = gtfsPayload?.nextStopName
                        ? `${gtfsPayload.nextStopName}${gtfsPayload.nextStopPlatform ? ` (Läge ${gtfsPayload.nextStopPlatform})` : ''}`
                        : null;

                    const panel = formatCompactPanel(
                        selectedVehicle,
                        gtfsPayload?.routeInfo,
                        gtfsPayload?.tripHeadsign,
                        formattedNextStop,
                        gtfsLoading,
                        journeyColor,
                        syncInfo?.line,
                        syncInfo?.headsign
                    );

                    // Improved contrast calculation
                    const getContrastColor = (hex: string) => {
                        if (!hex || !hex.startsWith('#')) return '#ffffff';
                        let r = 0, g = 0, b = 0;
                        if (hex.length === 4) {
                            r = parseInt(hex[1] + hex[1], 16);
                            g = parseInt(hex[2] + hex[2], 16);
                            b = parseInt(hex[3] + hex[3], 16);
                        } else if (hex.length === 7) {
                            r = parseInt(hex.substring(1, 3), 16);
                            g = parseInt(hex.substring(3, 5), 16);
                            b = parseInt(hex.substring(5, 7), 16);
                        } else {
                            return '#ffffff';
                        }
                        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
                        return (yiq >= 128) ? '#1e293b' : '#ffffff';
                    }

                    const numColor = getContrastColor(panel.lineColor);

                    if (!selectedVehicle || isNaN(selectedVehicle.lat) || isNaN(selectedVehicle.lng) || selectedVehicle.lat == null) {
                        return null;
                    }

                    return (
                        <Popup
                            position={[selectedVehicle.lat, selectedVehicle.lng]}
                            eventHandlers={{ remove: () => { setSelectedVehicle(null); setJourneyPath([]); } }}
                            closeButton={false}
                            autoPanPadding={[50, 50]}
                            offset={[0, -32]}
                            className="!p-0 vehicle-details-popup"
                        >
                            <div className="w-full max-w-[340px] pointer-events-auto relative overflow-hidden rounded-[1.5rem] shadow-[0_20px_50px_-10px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.6)] border border-slate-200/60 dark:border-white/10 backdrop-blur-3xl bg-white dark:bg-[#0f172a] ring-1 ring-black/5 mx-auto transition-all p-5 mb-2 mt-1">

                                <div className="flex flex-col relative z-10 w-full">
                                    {/* Top Row: Badge + Title + Close Button */}
                                    <div className="flex items-center gap-3 w-full relative pr-8">
                                        <div
                                            className="h-[36px] min-w-[48px] px-2 rounded-xl flex items-center justify-center font-black text-xl leading-none shadow-md shrink-0 border border-white/20"
                                            style={{
                                                backgroundColor: panel.lineColor,
                                                color: numColor,
                                                boxShadow: `0 4px 12px -2px ${panel.lineColor}60, inset 0 2px 4px 0 rgba(255,255,255,0.3)`
                                            }}
                                        >
                                            {panel.lineNumber}
                                        </div>
                                        <div className="font-extrabold text-slate-800 dark:text-white text-[18px] leading-tight truncate tracking-tight drop-shadow-sm min-w-0" title={panel.title}>
                                            {panel.title}
                                        </div>
                                        <button
                                            onClick={() => { setSelectedVehicle(null); setJourneyPath([]); }}
                                            className="absolute top-1/2 -translate-y-1/2 -right-2 w-8 h-8 shrink-0 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white flex items-center justify-center transition-all active:scale-90"
                                        >
                                            <FontAwesomeIcon icon={faXmark} className="text-lg" />
                                        </button>
                                    </div>

                                    {/* Intermediate Row: Subtitle (Nästa...) */}
                                    <div className="mt-4 flex flex-col gap-2">
                                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 text-[14px] font-semibold w-full truncate pr-4">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                                            <span className="truncate" title={panel.subtitle}>{panel.subtitle}</span>
                                        </div>
                                    </div>

                                    {/* Divider */}
                                    <div className="w-full h-[1px] bg-slate-200 dark:bg-slate-800 my-4" />

                                    {/* Bottom Section: Chips (Id, Hastighet) */}
                                    <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pt-1 pb-1">
                                        {gtfsLoading ? (
                                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0 border border-slate-200/50 dark:border-slate-700/50">
                                                <FontAwesomeIcon icon={faSpinner} className="animate-spin text-sky-500 text-sm" />
                                                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Hämtar rutt</span>
                                            </div>
                                        ) : (
                                            panel.chips.map((chip, i) => (
                                                <div key={i} className="flex flex-col shrink-0">
                                                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{chip.label}</span>
                                                    <div className="text-[14px] font-bold text-slate-800 dark:text-slate-200 tracking-tight flex items-center gap-1.5 mt-0.5">
                                                        {chip.label.toLowerCase() === 'operator' && (
                                                            <span className="w-4 h-4 rounded-[4px] bg-slate-100 flex items-center justify-center border border-slate-200">🚍</span>
                                                        )}
                                                        {chip.value}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        </Popup>
                    );
                })()}

            </MapContainer>





            {/* ── Premium Top Control Bar ── */}
            <div className="absolute top-4 right-4 z-[1000] flex items-center gap-3 pointer-events-none">

                {/* Operator pill */}
                <div className="pointer-events-auto flex items-center gap-2 h-11 px-3 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-white/40 dark:border-white/10 backdrop-blur-2xl bg-white/90 dark:bg-slate-900/90 transition-all hover:scale-[1.02] active:scale-[0.98]">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center shrink-0 shadow-inner">
                        <FontAwesomeIcon icon={faLocationArrow} className={`text-white text-[10px] ${isLoading ? 'animate-spin' : ''}`} />
                    </div>
                    <select
                        value={selectedOperator}
                        onChange={(e) => setSelectedOperator(e.target.value)}
                        className="bg-transparent font-extrabold text-slate-800 dark:text-white text-[13px] outline-none appearance-none cursor-pointer max-w-[150px] pr-2 focus:ring-0"
                    >
                        {TRAFIKLAB_OPERATORS.map(op => (
                            <option key={op.id} value={op.id} className="text-slate-800 font-medium">{op.name}</option>
                        ))}
                    </select>
                    <FontAwesomeIcon icon={faChevronDown} className="text-slate-400 text-[10px] pointer-events-none -ml-1 mr-1" />
                </div>

                {/* Vehicle count pill */}
                <div className="pointer-events-none hidden md:flex items-center h-11 px-4 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-white/20 backdrop-blur-2xl bg-gradient-to-r from-sky-500 to-blue-600">
                    <span className="font-black text-white text-[15px] leading-none tabular-nums tracking-tight">{vehicles.length}</span>
                    <span className="text-white/80 text-[10px] font-bold ml-1.5 uppercase tracking-wider">Fordon</span>
                </div>

                {/* Filter and settings group */}
                <div className="pointer-events-auto flex items-center h-11 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-white/40 dark:border-white/10 backdrop-blur-2xl bg-white/90 dark:bg-slate-900/90 px-1.5 gap-1 relative">

                    {/* Layer Filter Button */}
                    <button
                        onClick={() => setShowLayers(!showLayers)}
                        className={`flex items-center gap-2 px-3 h-8 rounded-full transition-all active:scale-95 ${showLayers
                            ? 'bg-sky-500 text-white shadow-md'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10'
                            }`}
                    >
                        <FontAwesomeIcon icon={faSliders} className="text-[13px]" />
                        <span className="font-bold text-[13px] tracking-tight hidden sm:inline">Filtrera</span>
                    </button>

                    {showLayers && (
                        <div className="absolute top-full right-0 mt-3 w-64 bg-white/95 dark:bg-slate-900/95 backdrop-blur-3xl rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] border border-white/40 dark:border-white/10 overflow-hidden z-[2000] animate-in slide-in-from-top-2 fade-in duration-200 ring-1 ring-black/5">
                            <div className="px-4 py-3 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/20">
                                <span className="font-black text-xs text-slate-800 dark:text-white uppercase tracking-widest px-1">Synliga fordon</span>
                                <button onClick={() => setShowLayers(false)} className="w-6 h-6 rounded-full bg-slate-200/50 dark:bg-slate-700/50 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors active:scale-90">
                                    <FontAwesomeIcon icon={faXmark} className="text-[10px]" />
                                </button>
                            </div>
                            <div className="p-2 space-y-1">
                                {[
                                    { id: 'BUS', icon: faBus, bg: 'bg-sky-500', label: 'Bussar' },
                                    { id: 'TRAM', icon: faTram, bg: 'bg-teal-500', label: 'Spårvagnar' },
                                    { id: 'TRAIN', icon: faTrain, bg: 'bg-fuchsia-500', label: 'Tåg & Pendel' },
                                    { id: 'FERRY', icon: faShip, bg: 'bg-indigo-500', label: 'Båtar' }
                                ].map(m => {
                                    const isActive = activeFilters.includes(m.id);
                                    return (
                                        <button
                                            key={m.id}
                                            onClick={() => toggleFilter(m.id)}
                                            className="w-full flex items-center justify-between px-3 py-2.5 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-[0.98]"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] shadow-sm ${m.bg} ${isActive ? 'opacity-100 scale-100' : 'opacity-40 grayscale scale-95'} transition-all duration-300`}>
                                                    <FontAwesomeIcon icon={m.icon} />
                                                </div>
                                                <span className={`font-bold text-[13px] ${isActive ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'} transition-colors`}>{m.label}</span>
                                            </div>
                                            <div className={`w-9 h-5 rounded-full relative transition-colors duration-300 ${isActive ? 'bg-sky-500' : 'bg-slate-200 dark:bg-slate-700'}`}>
                                                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-300 ${isActive ? 'left-[18px]' : 'left-0.5'}`} />
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="mx-4 my-1 border-t border-slate-100 dark:border-white/5" />

                            <div className="p-2 space-y-1 pb-3">
                                {/* Depot Toggle */}
                                <button
                                    onClick={() => setHideDepot(h => !h)}
                                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-[0.98]"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] bg-slate-200 dark:bg-slate-700 shadow-sm ${hideDepot ? 'opacity-100' : 'opacity-40 grayscale'} transition-all duration-300`}>
                                            🏭
                                        </div>
                                        <div className="text-left flex flex-col">
                                            <span className={`font-bold text-[13px] ${hideDepot ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'} transition-colors`}>Dölj depåfordon</span>
                                            <span className="text-[10px] text-slate-400 dark:text-slate-500 tracking-tight">Fordon utan aktiv linje</span>
                                        </div>
                                    </div>
                                    <div className={`w-9 h-5 rounded-full relative transition-colors duration-300 ${hideDepot ? 'bg-indigo-500' : 'bg-slate-200 dark:bg-slate-700'}`}>
                                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-300 ${hideDepot ? 'left-[18px]' : 'left-0.5'}`} />
                                    </div>
                                </button>

                                {/* Show Labels Toggle */}
                                <button
                                    onClick={() => setShowLabels(s => !s)}
                                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-[0.98]"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] bg-slate-200 dark:bg-slate-700 shadow-sm ${showLabels ? 'opacity-100' : 'opacity-40 grayscale'} transition-all duration-300`}>
                                            🏷️
                                        </div>
                                        <div className="text-left flex flex-col">
                                            <span className={`font-bold text-[13px] ${showLabels ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'} transition-colors`}>Visa ID-etiketter</span>
                                            <span className="text-[10px] text-slate-400 dark:text-slate-500 tracking-tight">Sista 4 sifforna på ikon</span>
                                        </div>
                                    </div>
                                    <div className={`w-9 h-5 rounded-full relative transition-colors duration-300 ${showLabels ? 'bg-amber-500' : 'bg-slate-200 dark:bg-slate-700'}`}>
                                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-300 ${showLabels ? 'left-[18px]' : 'left-0.5'}`} />
                                    </div>
                                </button>

                                {/* Satellit Toggle */}
                                <button
                                    onClick={() => setIsSatellite(s => !s)}
                                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-[0.98]"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-[12px] shadow-sm bg-sky-600 ${isSatellite ? 'opacity-100' : 'opacity-40 grayscale'} transition-all duration-300`}>
                                            <FontAwesomeIcon icon={faSatellite} />
                                        </div>
                                        <div className="text-left flex flex-col">
                                            <span className={`font-bold text-[13px] ${isSatellite ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'} transition-colors`}>Satellitkarta</span>
                                            <span className="text-[10px] text-slate-400 dark:text-slate-500 tracking-tight">Flygfotoläge (Esri)</span>
                                        </div>
                                    </div>
                                    <div className={`w-9 h-5 rounded-full relative transition-colors duration-300 ${isSatellite ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`}>
                                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-300 ${isSatellite ? 'left-[18px]' : 'left-0.5'}`} />
                                    </div>
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />

                    {/* Dark mode */}
                    <button
                        onClick={toggleDark}
                        title={isDark ? 'Ljust läge' : 'Mörkt läge'}
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90 ${isDark ? 'text-amber-400 hover:bg-amber-400/20' : 'text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10'}`}
                    >
                        <FontAwesomeIcon icon={isDark ? faSun : faMoon} className="text-[13px]" />
                    </button>

                    {/* Fullscreen */}
                    <button
                        onClick={toggleFullscreen}
                        title={isFullscreen ? 'Avsluta helskärm' : 'Helskärm'}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 transition-all active:scale-90"
                    >
                        <FontAwesomeIcon icon={isFullscreen ? faCompress : faExpand} className="text-[13px]" />
                    </button>
                </div>
            </div>
        </div>
    );
};
