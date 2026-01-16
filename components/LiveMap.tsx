import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import { AnimatedMarker } from './AnimatedMarker';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { TransitService } from '../services/transitService';
import { BusFront, Navigation, TrainFront, TramFront } from 'lucide-react';
import { renderToString } from 'react-dom/server';

// Fix for default Leaflet marker icon
// @ts-ignore
import icon from 'leaflet/dist/images/marker-icon.png';
// @ts-ignore
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

const REFRESH_INTERVAL = 15000; // 15 seconds



const MapEvents = ({ setVehicles, setStops, setParkings }: { setVehicles: (v: any[]) => void, setStops: (s: any[]) => void, setParkings: (p: any[]) => void }) => {
    const map = useMap();

    const fetchMapData = async () => {
        const bounds = map.getBounds();
        const minLat = bounds.getSouth();
        const minLng = bounds.getWest();
        const maxLat = bounds.getNorth();
        const maxLng = bounds.getEast();
        const zoom = map.getZoom();

        // 1. Fetch Vehicles
        if (zoom > 10) {
            const vehicleData = await TransitService.getVehiclePositions(minLat, minLng, maxLat, maxLng);
            setVehicles(vehicleData);
        }

        // 2. Fetch Stop Areas (Level 14+)
        if (zoom >= 14) {
            const stopData = await TransitService.getMapStopAreas(minLat, minLng, maxLat, maxLng);
            setStops(stopData);
        } else {
            setStops([]);
        }

        // 3. Fetch Parkings (Level 12+) - Parkings are sparse so we can show them earlier
        if (zoom >= 11) {
            const parkingData = await TransitService.getParkings(minLat, minLng, maxLat, maxLng);
            setParkings(parkingData);
        } else {
            setParkings([]);
        }
    };

    useEffect(() => {
        fetchMapData();
        const interval = setInterval(fetchMapData, REFRESH_INTERVAL);
        map.on('moveend', fetchMapData);
        return () => {
            clearInterval(interval);
            map.off('moveend', fetchMapData);
        };
    }, [map]);

    return null;
};

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
    const [selectedParking, setSelectedParking] = useState<any | null>(null);
    const [parkingImage, setParkingImage] = useState<string | null>(null);

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

    return (
        <div className="w-full h-[100dvh] md:h-full relative z-0">
            <MapContainer center={position} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false}>
                <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                />

                <MapEvents setVehicles={setVehicles} setStops={setStops} setParkings={setParkings} />

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
            </MapContainer>

            {/* Selected Journey Card */}
            {selectedVehicle && (
                <div className="absolute bottom-20 left-4 right-4 z-[400] md:left-auto md:w-80 md:right-4 md:bottom-6 bg-white/95 backdrop-blur-sm p-4 rounded-2xl shadow-xl border border-slate-200/60 animate-in slide-in-from-bottom-4 fade-in duration-300 pb-safe">
                    <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md ${selectedVehicle.transportMode === 'TRAM' ? 'bg-teal-600' : 'bg-sky-500'}`}>
                                {selectedVehicle.transportMode === 'TRAM' ? <TramFront size={20} /> : <BusFront size={20} />}
                            </div>
                            <div>
                                <h3 className="font-black text-lg text-slate-800 leading-none">Linje {selectedVehicle.line}</h3>
                                <div className="text-xs font-bold text-slate-500 mt-0.5">{selectedVehicle.transportMode === 'TRAM' ? 'Spårvagn' : 'Buss'} mot Destination</div>
                            </div>
                        </div>
                        <button onClick={() => { setSelectedVehicle(null); setJourneyPath([]); setJourneyStops([]); }} className="p-1 rounded-full hover:bg-slate-100 text-slate-400">
                            <span className="sr-only">Stäng</span>
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
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

            <div className="absolute top-safe-top mt-4 right-4 z-[400] bg-white/90 backdrop-blur p-2 rounded-xl shadow-lg border border-slate-100 flex flex-col gap-1 items-center">
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
    );
};
