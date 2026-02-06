import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import { AnimatedMarker } from './AnimatedMarker';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { TransitService } from '../services/transitService';
import { TRAFIKLAB_OPERATORS } from '../services/config';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBus, faTrain, faTram, faMap, faChevronDown, faLocationArrow, faXmark } from '@fortawesome/free-solid-svg-icons';
import { renderToString } from 'react-dom/server';

// ... (existing imports)

// ... (existing MapEvents component but updated props)
const MapEvents = ({ setVehicles, setStops, setParkings, setDisruptions, selectedOperator }: { setVehicles: (v: any[]) => void, setStops: (s: any[]) => void, setParkings: (p: any[]) => void, setDisruptions: (d: any[]) => void, selectedOperator?: string }) => {
    const map = useMap();

    // Fly to fleet region when operator changes
    useEffect(() => {
        if (selectedOperator) {
            setVehicles([]); // Clear old vehicles immediately
            const op = TRAFIKLAB_OPERATORS.find(o => o.id === selectedOperator);
            if (op && op.lat && op.lng) {
                // Fly to the region
                map.setView([op.lat, op.lng], 9);
            }
        }
    }, [selectedOperator, map]);

    const fetchMapData = async () => {
        const bounds = map.getBounds();
        const minLat = bounds.getSouth();
        const minLng = bounds.getWest();
        const maxLat = bounds.getNorth();
        const maxLng = bounds.getEast();
        const zoom = map.getZoom();

        // 1. Fetch Vehicles
        if (zoom > 8) { // Allow slightly wider zoom for regional operators
            const vehicleData = await TransitService.getVehiclePositions(minLat, minLng, maxLat, maxLng, selectedOperator);
            setVehicles(vehicleData);
        }

        // 2. Fetch Disruptions (Trafikverket) - Fetch globally or for area
        // Since we have coords now, we can optimize or just fetch all
        try {
            // Fetching all for now as the API doesn't filter by bbox easily
            const disruptions = await TransitService.getTrafikverketDisruptions();
            setDisruptions(disruptions);
        } catch (e) {
            console.error("Failed to fetch map disruptions", e);
        }

        // ... (rest of function)
    };

    useEffect(() => {
        fetchMapData();
        const interval = setInterval(fetchMapData, REFRESH_INTERVAL);
        map.on('moveend', fetchMapData);
        return () => {
            clearInterval(interval);
            map.off('moveend', fetchMapData);
        };
    }, [map, selectedOperator]); // Re-fetch when operator changes

    return null;
};

const REFRESH_INTERVAL = 15000; // 15 seconds

const VehicleMarker = ({ v, onSelect }: { v: any, onSelect: (v: any) => void }) => {
    // Custom DIV Icon for Vehicles
    const createIcon = (line: string, bearing: number, type?: string, colorBg: string = '') => {
        const isTram = type?.toUpperCase() === 'TRAM';

        // Premium Colors
        // Tram: Teal/Turquoise gradient
        // Bus: Sky/Blue gradient
        const bgClass = isTram
            ? 'bg-gradient-to-br from-teal-500 to-teal-700'
            : 'bg-gradient-to-br from-sky-500 to-sky-700';

        const html = renderToString(
            <div className="relative w-9 h-9 flex items-center justify-center filter drop-shadow-md transition-transform duration-300">
                {/* Main Badge */}
                <div
                    className={`absolute w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-black border-2 border-white/95 shadow-sm z-20 ${bgClass}`}
                >
                    <span className="drop-shadow-sm">{line}</span>
                </div>

                {/* Direction Pointer */}
                <div
                    className="absolute w-full h-full z-10"
                    style={{ transform: `rotate(${bearing}deg)` }}
                >
                    {/* Sharp Arrow Tip on Edge */}
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 drop-shadow-sm">
                        <svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M6 0L12 8H0L6 0Z" className={isTram ? 'fill-teal-600' : 'fill-sky-600'} />
                        </svg>
                    </div>
                </div>
            </div>
        );

        return L.divIcon({
            html: html,
            className: 'bg-transparent',
            iconSize: [36, 36],
            iconAnchor: [18, 18],
        });
    }

    return (
        <AnimatedMarker
            position={[v.lat, v.lng]}
            icon={createIcon(v.line, v.bearing || 0, v.transportMode)}
            eventHandlers={{
                click: () => onSelect(v)
            }}
        >

        </AnimatedMarker>
    );
};

export const LiveMap = () => {
    const [vehicles, setVehicles] = useState<any[]>([]);
    const [stops, setStops] = useState<any[]>([]);
    const [parkings, setParkings] = useState<any[]>([]);
    const [disruptions, setDisruptions] = useState<any[]>([]); // New State
    const [selectedParking, setSelectedParking] = useState<any | null>(null);
    const [parkingImage, setParkingImage] = useState<string | null>(null);
    const [selectedOperator, setSelectedOperator] = useState<string>('sweden'); // Default to aggregated

    // Route Selection State
    const [selectedVehicle, setSelectedVehicle] = useState<any | null>(null);
    const [journeyPath, setJourneyPath] = useState<[number, number][]>([]);
    const [journeyStops, setJourneyStops] = useState<any[]>([]);

    const handleSelectVehicle = async (v: any) => {
        setSelectedVehicle(v);
        setJourneyPath([]); // Reset

        if (v.detailsReference) {
            try {
                const details = await TransitService.getJourneyDetails(v.detailsReference);
                // Filter valid coordinates
                const coords = details
                    .filter((stop: any) => stop.coords && stop.coords.lat && stop.coords.lng)
                    .map((stop: any) => [stop.coords.lat, stop.coords.lng] as [number, number]);

                if (coords.length > 0) {
                    setJourneyPath(coords);
                    setJourneyStops(details.filter((s: any) => s.coords && s.coords.lat));
                }
            } catch (e) {
                console.error("Failed to load journey path", e);
            }
        }
    };

    // Fetch image when parking is selected
    useEffect(() => {
        if (selectedParking) {
            setParkingImage(null); // Reset
            // Try fetching camera 1 (some might have more, keeping simple)
            TransitService.getParkingImage(selectedParking.id, 1).then(url => {
                if (url) setParkingImage(url);
            });
        }
    }, [selectedParking]);

    // Default to Gothenburg
    const position: [number, number] = [57.70887, 11.97456];

    // PROD DISABLE - Feature Coming Soon
    if (import.meta.env.PROD) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-950 relative z-0">
                <div className="text-center p-8 max-w-md mx-auto">
                    <div className="w-24 h-24 bg-sky-100 dark:bg-sky-900/30 text-sky-500 rounded-3xl mx-auto flex items-center justify-center mb-6 shadow-xl shadow-sky-500/10 animate-in zoom-in-50 duration-500">
                        <FontAwesomeIcon icon={faMap} className="text-5xl animate-pulse" />
                    </div>
                    <h2 className="text-3xl font-black text-slate-800 dark:text-white mb-3 tracking-tight">Kartan kommer snart</h2>
                    <p className="text-slate-500 dark:text-slate-400 font-medium text-lg">Vi slipar på de sista detaljerna. Håll utkik!</p>

                    <div className="mt-8 inline-flex items-center gap-2 px-4 py-2 bg-slate-200 dark:bg-slate-800/50 rounded-full text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                        Under utveckling
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-[100dvh] md:h-full relative z-0">
            <MapContainer center={position} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false}>
                <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                />

                <MapEvents setVehicles={setVehicles} setStops={setStops} setParkings={setParkings} setDisruptions={setDisruptions} />

                {/* Render Journey Path */}
                {journeyPath.length > 0 && (
                    <>
                        <Polyline
                            positions={journeyPath}
                            pathOptions={{
                                color: selectedVehicle?.transportMode === 'TRAM' ? '#0d9488' : '#0ea5e9',
                                weight: 5,
                                opacity: 0.8
                            }}
                        />
                        {journeyStops.map((stop, idx) => (
                            <Marker
                                key={`journey-stop-${idx}`}
                                position={[stop.coords.lat, stop.coords.lng]}
                                icon={L.divIcon({
                                    className: 'bg-transparent',
                                    html: `<div class="w-2.5 h-2.5 bg-white border-2 border-${selectedVehicle?.transportMode === 'TRAM' ? 'teal-600' : 'sky-500'} rounded-full shadow-sm"></div>`,
                                    iconSize: [10, 10],
                                    iconAnchor: [5, 5]
                                })}
                            >
                                <Popup>
                                    <div className="font-bold text-xs">{stop.name}</div>
                                    <div className="text-xs text-slate-500">{stop.time}</div>
                                </Popup>
                            </Marker>
                        ))}
                    </>
                )}

                {/* Render Stops */}
                {stops.map(s => (
                    <Marker
                        key={s.id}
                        position={[s.lat, s.lng]}
                        icon={L.divIcon({
                            className: 'bg-transparent',
                            html: `<div class="w-3 h-3 bg-white border-2 border-slate-400 rounded-full shadow-sm"></div>`,
                            iconSize: [12, 12],
                            iconAnchor: [6, 6]
                        })}
                    >
                        <Popup>
                            <div className="font-sans text-sm font-bold text-slate-700">{s.name}</div>
                        </Popup>
                    </Marker>
                ))}

                {/* Render Parkings */}
                {parkings.map(p => (
                    <Marker
                        key={`parking-${p.id}`}
                        position={[p.lat, p.lng]}
                        eventHandlers={{
                            click: () => setSelectedParking(p)
                        }}
                        icon={L.divIcon({
                            className: 'bg-transparent',
                            html: `<div class="w-8 h-8 bg-blue-600 rounded-lg shadow-md border-2 border-white flex items-center justify-center text-white font-bold text-sm">P</div>`,
                            iconSize: [32, 32],
                            iconAnchor: [16, 32]
                        })}
                    >
                        <Popup>
                            <div className="font-sans w-48">
                                <h3 className="font-bold text-sm mb-1">{p.name}</h3>
                                {selectedParking?.id === p.id && (
                                    <div className="mt-2">
                                        {parkingImage ? (
                                            <div className="rounded overflow-hidden mb-2 relative aspect-video bg-slate-100">
                                                <img src={parkingImage} alt="Kamera" className="w-full h-full object-cover" />
                                                <div className="absolute bottom-1 right-1 bg-black/50 text-white text-[9px] px-1 rounded">LIVE</div>
                                            </div>
                                        ) : (
                                            <div className="text-xs text-slate-400 italic mb-2">Laddar kamerabild...</div>
                                        )}
                                    </div>
                                )}
                                <div className="text-xs text-slate-500">
                                    <span className="font-semibold">Platser:</span> {p.capacity || '?'}
                                </div>
                            </div>
                        </Popup>
                    </Marker>
                ))}

                {/* Render Vehicles */}
                {vehicles.map(v => (
                    <VehicleMarker key={v.id} v={v} onSelect={handleSelectVehicle} />
                ))}

                {/* Render Disruptions */}
                {disruptions.map(d => (
                    d.coordinates && d.coordinates.length > 0 && d.coordinates.map((coord: any, idx: number) => (
                        <Marker
                            key={`disruption-${d.id}-${idx}`}
                            position={[coord.lat, coord.lng]}
                            icon={L.divIcon({
                                className: 'bg-transparent',
                                html: `<div class="w-8 h-8 bg-amber-500 rounded-full shadow-lg border-2 border-white flex items-center justify-center text-white animate-pulse"><svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg></div>`,
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
                ))}
            </MapContainer>

            {/* Selected Journey Card */}
            {selectedVehicle && (
                <div className="absolute bottom-20 left-4 right-4 z-[400] md:left-auto md:w-80 md:right-4 md:bottom-6 bg-white/95 backdrop-blur-sm p-4 rounded-2xl shadow-xl border border-slate-200/60 animate-in slide-in-from-bottom-4 fade-in duration-300 pb-safe">
                    <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md ${selectedVehicle.transportMode === 'TRAM' ? 'bg-teal-600' : 'bg-sky-500'}`}>
                                {selectedVehicle.transportMode === 'TRAM' ? <FontAwesomeIcon icon={faTram} className="text-xl" /> : <FontAwesomeIcon icon={faBus} className="text-xl" />}
                            </div>
                            <div>
                                <h3 className="font-black text-lg text-slate-800 leading-none">Linje {selectedVehicle.line}</h3>
                                <div className="text-xs font-bold text-slate-500 mt-0.5">{selectedVehicle.transportMode === 'TRAM' ? 'Spårvagn' : 'Buss'} mot Destination</div>
                            </div>
                        </div>
                        <button onClick={() => { setSelectedVehicle(null); setJourneyPath([]); setJourneyStops([]); }} className="p-1 rounded-full hover:bg-slate-100 text-slate-400">
                            <span className="sr-only">Stäng</span>
                            <FontAwesomeIcon icon={faXmark} className="text-lg" />
                        </button>
                    </div>

                    <div className="space-y-3">
                        {/* Route Info */}
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nästa Hållplats</span>
                                {selectedVehicle.delay && (
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${selectedVehicle.delay > 0 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                                        {selectedVehicle.delay > 0 ? `+${selectedVehicle.delay} min` : 'I tid'}
                                    </span>
                                )}
                            </div>
                            <div className="font-bold text-slate-700 text-sm flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-slate-400"></div>
                                {selectedVehicle.nextStop || "Okänd hållplats"}
                            </div>
                        </div>

                        {/* Journey Stats */}
                        <div className="grid grid-cols-1 gap-2">
                            <div className="p-2 bg-slate-50 rounded-lg text-center border border-slate-100">
                                <div className="text-[9px] font-bold text-slate-400 uppercase">Hållplatser</div>
                                <div className="font-black text-slate-700">{journeyStops.length > 0 ? journeyStops.length : '-'} <span className="text-[10px] font-medium text-slate-400">kvar</span></div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Top Right Controls */}
            <div
                className="absolute top-4 right-4 z-[1000] flex flex-col gap-2 items-end"
                style={{ top: 'max(1rem, env(safe-area-inset-top) + 1rem)' }}
            >

                {/* Operator Selector */}
                <div className="bg-white/95 backdrop-blur-sm p-1 rounded-xl shadow-lg border border-slate-200/60 max-w-[200px]">
                    <div className="relative">
                        <select
                            value={selectedOperator}
                            onChange={(e) => {
                                setSelectedOperator(e.target.value);
                                // Optional: Fly to operator region if selected? 
                                // Implementing "flyTo" would require moving map logic up or exposing it.
                                // For now just changing the filter.
                            }}
                            className="w-full pl-3 pr-8 py-2 bg-transparent text-xs font-bold text-slate-700 outline-none appearance-none cursor-pointer"
                        >
                            {TRAFIKLAB_OPERATORS.map(op => (
                                <option key={op.id} value={op.id}>{op.name}</option>
                            ))}
                        </select>
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                            <FontAwesomeIcon icon={faChevronDown} className="text-xs" />
                        </div>
                    </div>
                </div>

                {/* Live Count Badge */}
                <div className="bg-white/90 backdrop-blur p-2 rounded-xl shadow-lg border border-slate-100 flex flex-col gap-1 items-center self-end">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Live</div>
                    <div className="flex items-center gap-1.5 text-sky-600">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
                        </span>
                        <span className="text-xs font-bold">{vehicles.length} fordon</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
