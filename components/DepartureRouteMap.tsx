import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Coordinates } from '../types';

// @ts-ignore
import icon from 'leaflet/dist/images/marker-icon.png';
// @ts-ignore
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Hook for dark mode detection
const useDarkMode = () => {
    const [isDark, setIsDark] = useState(document.documentElement.classList.contains('dark'));

    useEffect(() => {
        const observer = new MutationObserver(() => {
            setIsDark(document.documentElement.classList.contains('dark'));
        });

        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class'],
        });

        return () => observer.disconnect();
    }, []);

    return isDark;
};

interface DepartureRouteMapProps {
    stops: {
        name: string;
        time: string;
        coords?: Coordinates;
        isCancelled?: boolean;
    }[];
    color?: string;
}

// Helper to fit bounds
const MapBoundsFitter: React.FC<{ coords: [number, number][] }> = ({ coords }) => {
    const map = useMap();

    useEffect(() => {
        if (coords.length > 0) {
            const bounds = L.latLngBounds(coords);
            map.fitBounds(bounds, { padding: [20, 20] });
        }
    }, [coords, map]);

    return null;
};

export const DepartureRouteMap: React.FC<DepartureRouteMapProps> = ({ stops, color = '#0ea5e9' }) => {
    // Filter stops that have coordinates
    const validStops = stops.filter(s => s.coords && s.coords.lat && s.coords.lng);
    const isDark = useDarkMode();

    if (validStops.length < 2) {
        return (
            <div className="h-40 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 text-xs">
                Karta inte tillgänglig för denna rutt
            </div>
        );
    }

    const positions: [number, number][] = validStops.map(s => [s.coords!.lat, s.coords!.lng]);

    return (
        <div className="h-48 w-full rounded-xl overflow-hidden shadow-inner border border-slate-200 dark:border-slate-700 relative z-0">
            <MapContainer
                zoom={13}
                center={positions[0]}
                style={{ height: '100%', width: '100%' }}
                zoomControl={false}
                attributionControl={false}
                dragging={false} // Static map feel
                doubleClickZoom={false}
                scrollWheelZoom={false}
            >
                <TileLayer
                    url={isDark
                        ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                        : "https://osm.vasttrafik.se/styles/osm_vt_basic/{z}/{x}/{y}.png"}
                    attribution={isDark
                        ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                        : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; Västtrafik'}
                />

                <MapBoundsFitter coords={positions} />

                <Polyline
                    positions={positions}
                    pathOptions={{ color: color, weight: 4, opacity: 0.8 }}
                />

                {/* Start Marker */}
                <Marker position={positions[0]}>
                    <Tooltip direction="top" offset={[0, -20]} opacity={1} permanent>
                        Start: {validStops[0].time}
                    </Tooltip>
                </Marker>

                {/* End Marker */}
                <Marker position={positions[positions.length - 1]}>
                    <Tooltip direction="bottom" offset={[0, 20]} opacity={1} permanent>
                        Slut: {validStops[validStops.length - 1].time}
                    </Tooltip>
                </Marker>

                {/* Intermediate dots */}
                {validStops.slice(1, -1).map((stop, idx) => (
                    <circle
                        key={idx}
                        cx={stop.coords!.lat}
                        cy={stop.coords!.lng}
                        r={3}
                        fill={color}
                    />
                    // Note: Leaflet doesn't support <circle> directly as JSX like SVG. 
                    // Using CircleMarker is better.
                ))}

                {validStops.slice(1, -1).map((stop, idx) => (
                    <Marker
                        key={idx}
                        position={[stop.coords!.lat, stop.coords!.lng]}
                        icon={L.divIcon({
                            className: 'bg-transparent',
                            html: `<div style="width: 8px; height: 8px; background-color: white; border: 2px solid ${color}; border-radius: 50%;"></div>`,
                            iconSize: [8, 8],
                            iconAnchor: [4, 4]
                        })}
                    >
                        <Tooltip direction="top" opacity={0.9}>{stop.name}</Tooltip>
                    </Marker>
                ))}

            </MapContainer>
        </div>
    );
};
