
import { API_KEYS, API_URLS } from './config';
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
    },

    getDepartures: async (stopId: string): Promise<any[]> => {
        if (!API_KEYS.RESROBOT_API_KEY) {
            console.warn("Missing RESROBOT_API_KEY");
            return [];
        }

        const url = `${API_URLS.RESROBOT_API}/departureBoard?id=${stopId}&format=json&accessId=${API_KEYS.RESROBOT_API_KEY}&passlist=0`;

        try {
            console.log(`[Resrobot] Fetching departures for stop ${stopId}`);
            let res;

            // Handle Proxy/CORS
            if (import.meta.env.DEV) {
                res = await fetch(url);
            } else {
                // In production, use corsproxy if needed, or direct if allowed. 
                // Using fetchWithCors helper defined above.
                // Reconstruct full URL for proxy if using API_URLS.RESROBOT_API which might be relative?
                // API_URLS.RESROBOT_API is absolute in prod.
                res = await fetchWithCors(url);
            }

            if (!res.ok) {
                console.error(`[Resrobot] Fetch failed: ${res.status}`);
                return [];
            }

            const data = await res.json();
            const departures = data.Departure || [];

            return departures.map((dep: any) => {
                // Extract Line Number
                // 'name' often contains "Länstrafik - 101" or "Buss 101". 
                // Product.num is usually more direct e.g. "101".
                let line = dep.name;
                if (dep.Product && dep.Product.num) {
                    line = dep.Product.num;
                } else if (dep.Product && Array.isArray(dep.Product) && dep.Product[0]?.num) {
                    line = dep.Product[0].num;
                } else {
                    // Fallback regex to get number from "Buss 101"
                    const match = dep.name.match(/(\d+)$/);
                    if (match) line = match[1];
                }

                return {
                    line: line,
                    destination: dep.direction,
                    time: dep.time.substring(0, 5), // Ensure HH:MM
                    rtTime: dep.rtTime ? dep.rtTime.substring(0, 5) : null,
                    date: dep.date,
                    track: dep.track || null,
                    journeyRef: dep.JourneyDetailRef?.ref || null,
                    // Additional helpful fields
                    formattedTime: dep.rtTime || dep.time, // For sorting/display logic
                    isLate: dep.rtTime && dep.rtTime !== dep.time,
                    type: dep.ProductAtStop?.cls || 'BUS' // Class: B=Bus, etc.
                };
            });

        } catch (error) {
            console.error("[Resrobot] Error fetching departures:", error);
            return [];
        }
    },

    getJourneyDetails: async (journeyRef: string): Promise<any> => {
        if (!API_KEYS.RESROBOT_API_KEY) {
            console.warn("Missing RESROBOT_API_KEY");
            return null;
        }

        // Handle URL encoding for the ref if needed, though usually it's passed as is or already encoded.
        // Resrobot refs can be long strings.
        const url = `${API_URLS.RESROBOT_API}/journeyDetail?ref=${encodeURIComponent(journeyRef)}&format=json&accessId=${API_KEYS.RESROBOT_API_KEY}`;

        try {
            console.log(`[Resrobot] Fetching journey details for ref: ${journeyRef}`);
            let res;

            if (import.meta.env.DEV) {
                res = await fetch(url);
            } else {
                res = await fetchWithCors(url);
            }

            if (!res.ok) {
                console.error(`[Resrobot] Fetch failed: ${res.status}`);
                return null;
            }

            const data = await res.json();
            const stops = data.JourneyDetail?.Stop || [];

            return {
                stops: stops.map((stop: any) => ({
                    id: stop.id,
                    name: stop.name,
                    arrTime: stop.arrTime ? stop.arrTime.substring(0, 5) : null,
                    depTime: stop.depTime ? stop.depTime.substring(0, 5) : null,
                    rtArrTime: stop.rtArrTime ? stop.rtArrTime.substring(0, 5) : null,
                    rtDepTime: stop.rtDepTime ? stop.rtDepTime.substring(0, 5) : null,
                    track: stop.track,
                    routeIdx: stop.routeIdx
                }))
            };

        } catch (error) {
            console.error("[Resrobot] Error fetching journey details:", error);
            return null;
        }
    }
};


