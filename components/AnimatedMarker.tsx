import React, { useEffect, useRef, useState } from 'react';
import { Marker } from 'react-leaflet';
import L from 'leaflet';

interface AnimatedMarkerProps {
    position: [number, number];
    icon: L.DivIcon | L.Icon;
    children?: React.ReactNode;
    eventHandlers?: L.LeafletEventHandlerFnMap;
    title?: string;
    speed?: number; // km/h
    bearing?: number; // degrees
}

const R = 6378137; // Earth Radius

export const AnimatedMarker: React.FC<AnimatedMarkerProps> = ({
    position,
    icon,
    children,
    eventHandlers,
    title,
    speed = 0,
    bearing = 0
}) => {
    const markerRef = useRef<L.Marker>(null);
    const rafId = useRef<number>();

    const virtPos = useRef<{ lat: number, lng: number }>({ lat: position[0], lng: position[1] });
    const lastTick = useRef<number>(performance.now());
    const targetPos = useRef<{ lat: number, lng: number }>({ lat: position[0], lng: position[1] });
    const lastPositionUpdate = useRef<number>(performance.now());

    useEffect(() => {
        targetPos.current = { lat: position[0], lng: position[1] };
        lastPositionUpdate.current = performance.now();

        // If we are way too far off (e.g. initial load or >500m jump), snap directly
        const distSq = Math.pow(virtPos.current.lat - position[0], 2) + Math.pow(virtPos.current.lng - position[1], 2);
        if (distSq > 0.0001) {
            virtPos.current = { lat: position[0], lng: position[1] };
        }
    }, [position[0], position[1]]);

    useEffect(() => {
        const marker = markerRef.current;
        if (!marker) return;

        const step = (now: number) => {
            const dt = (now - lastTick.current) / 1000; // seconds
            lastTick.current = now;

            if (dt > 0 && dt < 1) { // Ignore huge frame drops
                let rawNewLat = virtPos.current.lat;
                let rawNewLng = virtPos.current.lng;

                // 1. Continuous Forward Dead Reckoning
                // Only dead-reckon if data is fresh (received within the last 15 seconds)
                const timeSinceLastUpdate = now - lastPositionUpdate.current;

                if (speed > 0 && timeSinceLastUpdate < 15000) {
                    const speedMps = speed / 3.6;
                    const d = speedMps * dt;
                    const brng = (bearing * Math.PI) / 180;
                    const lat1 = (rawNewLat * Math.PI) / 180;
                    const lon1 = (rawNewLng * Math.PI) / 180;

                    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d / R) + Math.cos(lat1) * Math.sin(d / R) * Math.cos(brng));
                    const lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(d / R) * Math.cos(lat1), Math.cos(d / R) - Math.sin(lat1) * Math.sin(lat2));

                    rawNewLat = (lat2 * 180) / Math.PI;
                    rawNewLng = (lon2 * 180) / Math.PI;
                }

                // 2. Smoothly pull towards the true server target 
                // Using exponential decay: corrects 63% of the discrepancy per second
                const pullFactor = 1 - Math.exp(-1.0 * dt);

                virtPos.current.lat = rawNewLat + (targetPos.current.lat - rawNewLat) * pullFactor;
                virtPos.current.lng = rawNewLng + (targetPos.current.lng - rawNewLng) * pullFactor;

                // Update marker visually
                marker.setLatLng([virtPos.current.lat, virtPos.current.lng]);
            }

            rafId.current = requestAnimationFrame(step);
        };

        lastTick.current = performance.now();
        rafId.current = requestAnimationFrame(step);

        return () => { if (rafId.current) cancelAnimationFrame(rafId.current); };
    }, [speed, bearing]); // Re-bind loop if physics constants change

    // Prevent React-Leaflet from snapping by fixing the initial mount position
    const [mountPos] = useState<[number, number]>([position[0], position[1]]);

    return (
        <Marker
            ref={markerRef}
            position={mountPos}
            icon={icon}
            eventHandlers={eventHandlers}
            title={title}
        >
            {children}
        </Marker>
    );
};
