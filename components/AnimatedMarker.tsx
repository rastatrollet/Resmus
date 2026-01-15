import React, { useEffect, useRef, useState } from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
// Simple Lerp
const lerp = (start: number, end: number, t: number) => {
    return start * (1 - t) + end * t;
};

interface AnimatedMarkerProps {
    position: [number, number];
    icon: L.DivIcon | L.Icon;
    rotationAngle?: number;
    children?: React.ReactNode;
    eventHandlers?: L.LeafletEventHandlerFnMap;
}

export const AnimatedMarker: React.FC<AnimatedMarkerProps> = ({ position, icon, rotationAngle = 0, children, eventHandlers }) => {
    const markerRef = useRef<L.Marker>(null);
    const prevPosRef = useRef(position);
    const targetPosRef = useRef(position);
    const startTimeRef = useRef<number>(0);
    const animationFrameRef = useRef<number>();

    // Duration matches refresh rate (15s) + buffer to ensure "always moving" effect.
    // User requested "vehicles move all the time".
    const DURATION = 20000;

    useEffect(() => {
        const marker = markerRef.current;
        if (!marker) return;

        // If position changed significantly
        if (position[0] !== targetPosRef.current[0] || position[1] !== targetPosRef.current[1]) {
            // Start from current actual position (if mid-animation) or previous target
            // Actually, best to start from where it IS right now (marker.getLatLng())
            const currentLatLng = marker.getLatLng();
            prevPosRef.current = [currentLatLng.lat, currentLatLng.lng];
            targetPosRef.current = position;
            startTimeRef.current = performance.now();

            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);

            const animate = (time: number) => {
                const elapsed = time - startTimeRef.current;
                const t = Math.min(elapsed / DURATION, 1);

                // Linear Interpolation for map movement (standard)
                const newLat = lerp(prevPosRef.current[0], targetPosRef.current[0], t);
                const newLng = lerp(prevPosRef.current[1], targetPosRef.current[1], t);

                marker.setLatLng([newLat, newLng]);

                if (t < 1) {
                    animationFrameRef.current = requestAnimationFrame(animate);
                } else {
                    // Snap to exact target at end to prevent float drift
                    marker.setLatLng(targetPosRef.current);
                }
            };

            animationFrameRef.current = requestAnimationFrame(animate);
        }

        return () => {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        };
    }, [position]);

    // We pass the *initial* position to the Marker to mount it.
    // Subsequent moves are handled by the effect calling setLatLng directly.
    // This avoids React renders for every frame.
    // IMPORTANT: We use a ref to hold the initial pos so it doesn't change on re-renders,
    // protecting against React-Leaflet fighting us.
    // Actually, if we pass 'position' prop to Marker, React-Leaflet updates it.
    // We should pass 'prevPosRef.current' or just the initial mount position?
    // If we pass 'position', React-Leaflet calls setLatLng too.
    // TRICK: We pass a separate state 'initialPos' that never updates after mount?
    // Or we just accept that React-Leaflet calls setLatLng once on prop change (snap), 
    // and we override it? No, that causes jump.
    // FIX: AnimatedMarker should NOT pass changed 'position' down to Marker.

    const [initialPos] = useState(position);

    return (
        <Marker
            ref={markerRef}
            position={initialPos} // Only used for initial placement
            icon={icon}
            eventHandlers={eventHandlers}
        >
            {children}
        </Marker>
    );
};
