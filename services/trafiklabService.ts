
import { API_KEYS } from './config';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';

// Helper for CORS requests
const fetchWithCors = async (url: string, options: RequestInit = {}) => {
    const targetUrl = `${url}${url.includes('?') ? '&' : '?'}_t=${Date.now()}`;
    const proxyUrl = "https://corsproxy.io/?" + encodeURIComponent(targetUrl);
    return fetch(proxyUrl, options);
};

export interface VehiclePosition {
    id: string;
    line: string;
    direction: string;
    lat: number;
    lng: number;
    bearing?: number;
    speed?: number;
    type: string;
    operator?: string;
}

export const TrafiklabService = {
    getLiveVehicles: async (operatorId: string = 'sweden', bbox?: { minLat: number, minLng: number, maxLat: number, maxLng: number }): Promise<VehiclePosition[]> => {
        if (!API_KEYS.TRAFIKLAB_API_KEY) {
            console.warn("Missing TRAFIKLAB_API_KEY in config.ts");
            return [];
        }

        // GTFS Regional Realtime - using PBF (Binary) format as standard
        // Note: Removing format=JSON because regional feeds (like Kalmar) often only support PBF.
        // Use local proxy in DEV to avoid 403s from public CORS proxies
        let url = "";

        // Correct path for "GTFS Sweden 3" vs Regional Feeds
        // All feeds follow the gtfs-rt/{operator}/VehiclePositions.pb pattern
        const path = `gtfs-rt/${operatorId}/VehiclePositions.pb`;

        if (import.meta.env.DEV) {
            url = `/trafiklab-proxy/${path}?key=${API_KEYS.TRAFIKLAB_API_KEY}`;
        } else {
            url = `https://opendata.samtrafiken.se/${path}?key=${API_KEYS.TRAFIKLAB_API_KEY}`;
        }

        try {
            console.log(`[Trafiklab] Fetching PBF from: ${url}`);

            // In DEV, fetch directly (via Vite proxy). In PROD, use CORS proxy.
            let res;
            if (import.meta.env.DEV) {
                // Pass headers to avoid 403 from API if strictly checking User-Agent/Referer
                res = await fetch(url);
            } else {
                res = await fetchWithCors(url);
            }

            if (!res.ok) {
                console.error(`[Trafiklab] Fetch failed: ${res.status} ${res.statusText}`);
                return [];
            }

            // Get as ArrayBuffer
            const buffer = await res.arrayBuffer();
            console.log(`[Trafiklab] Received buffer of size: ${buffer.byteLength}`);

            if (buffer.byteLength === 0) {
                console.warn("[Trafiklab] Received empty buffer");
                return [];
            }

            // Decode PBF
            let data;
            try {
                // Prepare buffer for binding. If using browser, result is ArrayBuffer which Uint8Array accepts.
                const uint8 = new Uint8Array(buffer);
                data = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(uint8);
            } catch (decodeErr) {
                console.error("[Trafiklab] Failed to decode GTFS PBF data:", decodeErr);
                return [];
            }

            const entities = data.entity || [];
            console.log(`[Trafiklab] Decoded ${entities.length} entities`);

            if (!entities.length) return [];

            const vehicles: VehiclePosition[] = [];

            entities.forEach((entity: any) => {
                const v = entity.vehicle;
                if (!v || !v.position) return;

                const pos = v.position;

                // GTFS bindings usually return proper keys
                const lat = pos.latitude;
                const lng = pos.longitude;

                if (typeof lat !== 'number' || typeof lng !== 'number') return;

                // BBox Filter
                if (bbox) {
                    if (lat < bbox.minLat || lat > bbox.maxLat || lng < bbox.minLng || lng > bbox.maxLng) {
                        return;
                    }
                }

                // Line info
                const line = v.trip?.routeId || v.vehicle?.label || "?";

                vehicles.push({
                    id: v.vehicle?.id || entity.id,
                    line: String(line),
                    direction: "Se rutt", // GTFS-RT doesn't commonly include headsign in VehiclePositions
                    lat: lat,
                    lng: lng,
                    bearing: pos.bearing || 0,
                    speed: pos.speed,
                    type: 'BUS', // Default
                    operator: operatorId
                });
            });

            console.log(`[Trafiklab] Returning ${vehicles.length} vehicles after filter`);
            return vehicles;

        } catch (e) {
            console.error("[Trafiklab] Error fetching GTFS-RT positions:", e);
            return [];
        }
    }
};


