
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
    direction?: string;
    lat: number;
    lng: number;
    bearing?: number;
    speed?: number;
    type: string;
    operator?: string;
    // GTFS-RT trip linkage (used for shape resolution)
    tripId?: string;
    routeId?: string;
    vehicleLabel?: string;
    // Real-time status
    currentStatus?: string;   // IN_TRANSIT_TO | STOPPED_AT | INCOMING_AT
    stopId?: string;
    stopSequence?: number;
    occupancyStatus?: string;
    timestamp?: number;       // Unix seconds
}


const inferOperatorFromId = (id?: string): string | null => {
    if (!id) return null;

    // SL
    if (id.startsWith('9011') || id.startsWith('1082') || id.startsWith('1065')) return 'sl';

    // Skånetrafiken
    if (id.startsWith('9031') || id.startsWith('9024') || id.startsWith('9025')) return 'skane';

    // Östgötatrafiken
    if (id.startsWith('9021')) return 'otraf';

    // UL
    if (id.startsWith('9012')) return 'ul';

    // Dalatrafik
    if (id.startsWith('9023')) return 'dt';

    // Värmland
    if (id.startsWith('9022')) return 'varm';

    // Sörmland
    if (id.startsWith('9016')) return 'sormland';

    // Kronoberg
    if (id.startsWith('9032')) return 'krono';

    // Jönköping
    if (id.startsWith('9020')) return 'jlt';

    // Kalmar
    if (id.startsWith('9019')) return 'klt';

    // Halland
    if (id.startsWith('9026')) return 'halland';

    // Blekinge
    if (id.startsWith('9017')) return 'blekinge';

    // X-Trafik
    if (id.startsWith('9014')) return 'xt';

    return null;
};

/**
 * Infer transport mode from routeId NeTEx prefix.
 * NeTEx route IDs follow the pattern:
 *   9011XXXX000XXXXX  = SL
 *   where position 9 (0-indexed from character 9) encodes the mode:
 *   9011XXXX001XXXXX = Tram (1)
 *   9011XXXX002XXXXX = Subway/Metro (2) 
 *   9011XXXX003XXXXX = Rail (3)
 *   9011XXXX004XXXXX = Bus (4 - rare)
 *   ... varies
 * For Västtrafik and others:
 *   9015XXXX0XX = Tram (Göteborg)
 *   The mode is usually embedded in the route_type, not the ID.
 * Safest heuristic: look at the raw routeId for keywords or use trip type.
 */
const inferModeFromRouteId = (routeId?: string): string => {
    if (!routeId) return 'BUS';
    // NeTEx ID mode detection based on character 11-12 (the 'mode' segment)
    // E.g. 9031NNN001000000 = Tram (001), 9031NNN002000000 = Metro, etc.
    // Pattern: 9 digits region code, then mode digits
    const modeMatch = routeId.match(/^(\d{4})(\d{3,4})(0{0,3})(\d+)/);
    if (modeMatch) {
        // The 5th block or the type segment varies by operator
        // Common: positions 8-10 encode type in Samtrafiken NeTEx
        const segment8to12 = routeId.slice(8, 12);
        const modeNum = parseInt(segment8to12, 10);
        // Typical NeTEx operator codes:
        // 1 = Tram, 2 = Metro, 3 = Rail, 4 = Bus, 7 = Coach, ...
        if (routeId.includes('001000')) return 'TRAM';   // Tram
        if (routeId.includes('002000')) return 'TRAIN';  // Metro / T-bana
        if (routeId.includes('003000')) return 'TRAIN';  // Rail / Pendel
        if (routeId.includes('004000')) return 'FERRY';  // Ferry
        if (!isNaN(modeNum) && modeNum >= 1000 && modeNum < 2000) return 'TRAM';
        if (!isNaN(modeNum) && modeNum >= 2000 && modeNum < 3000) return 'TRAIN';
        if (!isNaN(modeNum) && modeNum >= 3000 && modeNum < 4000) return 'TRAIN';
        if (!isNaN(modeNum) && modeNum >= 4000 && modeNum < 5000) return 'FERRY';
    }
    return 'BUS'; // Default
};

/**
 * Check if a string is a raw NeTEx/GTFS ID (not a human-readable line label).
 * True NeTEx IDs are long numeric strings (14-18 digits), e.g. "9021014001000100".
 * Human-readable line labels are short (1-4 chars), e.g. "4", "55X", "E20".
 */
const isNetExId = (str?: string): boolean => {
    if (!str) return false;
    // NeTEx IDs are purely numeric and longer than 8 digits
    return /^\d{8,}$/.test(str);
};

const getRegionalOperator = (lat: number, lng: number): string => {
    // Priority order: Small/dense regions first, large/overlapping regions later

    // Stockholm (SL) - expanded bounds
    if (lat >= 58.7 && lat <= 60.3 && lng >= 17.0 && lng <= 19.5) return 'sl';

    // Skåne (Skånetrafiken)
    if (lat >= 55.3 && lat <= 56.5 && lng >= 12.4 && lng <= 14.6) return 'skane';

    // Halland - dedicated check
    // 56.3 - 57.6 covers Halmstad to Kungsbacka
    if (lat >= 56.3 && lat <= 57.6 && lng >= 11.8 && lng <= 13.5) return 'halland';

    // Uppsala (UL)
    if (lat >= 59.2 && lat <= 60.7 && lng >= 16.9 && lng <= 18.2) return 'ul';

    // Örebro Län
    if (lat >= 58.7 && lat <= 60.0 && lng >= 14.3 && lng <= 15.6) return 'orebro';

    // Värmland
    if (lat >= 59.0 && lat <= 61.0 && lng >= 12.0 && lng <= 14.3) return 'varm';

    // Östergötland (Östgötatrafiken)
    if (lat >= 57.7 && lat <= 58.9 && lng >= 14.5 && lng <= 16.9) return 'otraf';

    // Jönköping (JLT)
    if (lat >= 57.1 && lat <= 58.2 && lng >= 13.5 && lng <= 15.6) return 'jlt';

    // Kronoberg
    if (lat >= 56.4 && lat <= 57.2 && lng >= 13.5 && lng <= 15.6) return 'krono';

    // Kalmar (KLT)
    if (lat >= 56.2 && lat <= 58.0 && lng >= 15.5 && lng <= 17.2) return 'klt';

    // Halland
    if (lat >= 56.3 && lat <= 57.6 && lng >= 11.8 && lng <= 13.4) return 'halland';

    // Dalarna (Dalatrafik)
    if (lat >= 60.0 && lat <= 62.3 && lng >= 13.0 && lng <= 16.8) return 'dt';

    // Gävleborg (X-trafik)
    if (lat >= 60.2 && lat <= 62.3 && lng >= 16.0 && lng <= 17.8) return 'xt';

    // Västmanland (VL)
    if (lat >= 59.2 && lat <= 60.2 && lng >= 15.5 && lng <= 17.0) return 'vastmanland';

    // Sörmland
    if (lat >= 58.6 && lat <= 59.6 && lng >= 15.8 && lng <= 17.6) return 'sormland';

    // Blekinge
    if (lat >= 56.0 && lat <= 56.5 && lng >= 14.5 && lng <= 16.0) return 'blekinge';

    // Västernorrland (Din Tur)
    if (lat >= 62.0 && lat <= 64.0 && lng >= 16.0 && lng <= 19.5) return 'dintur';

    // Jämtland
    if (lat >= 61.5 && lat <= 65.0 && lng >= 12.0 && lng <= 16.0) return 'jamtland';

    // Västerbotten
    if (lat >= 63.5 && lat <= 65.5 && lng >= 15.0 && lng <= 21.0) return 'vasterbotten';

    // Norrbotten
    if (lat >= 65.0 && lat <= 69.1 && lng >= 16.0 && lng <= 24.2) return 'norrbotten';

    // Gotland
    if (lat >= 56.8 && lat <= 58.0 && lng >= 18.0 && lng <= 19.5) return 'gotland';

    return 'sl'; // Default fallback
};

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

                // ── Extract all available GTFS-RT fields ──────────────────────────────
                const tripId = v.trip?.tripId ?? undefined;
                const routeId = v.trip?.routeId ?? undefined;
                const vehicleLabel = v.vehicle?.label ?? undefined;
                const vehicleId = v.vehicle?.id || entity.id;

                // Line display: prefer vehicle label (e.g. "4"), then short routeId.
                // IMPORTANT: Never display raw NeTEx IDs (long numeric strings) as line label.
                // The GTFS static resolver will fix this later; for now show '?' to avoid confusion.
                let line: string = '?';
                if (vehicleLabel && !isNetExId(vehicleLabel)) {
                    line = vehicleLabel;
                } else if (routeId && !isNetExId(routeId)) {
                    line = routeId;
                }

                // Current status enum → string
                const statusEnum = v.currentStatus;
                let currentStatus: string | undefined;
                if (statusEnum === 0) currentStatus = 'INCOMING_AT';
                else if (statusEnum === 1) currentStatus = 'STOPPED_AT';
                else if (statusEnum === 2) currentStatus = 'IN_TRANSIT_TO';

                // Occupancy
                const occEnum = v.occupancyStatus;
                let occupancyStatus: string | undefined;
                if (occEnum === 0) occupancyStatus = 'EMPTY';
                else if (occEnum === 1) occupancyStatus = 'MANY_SEATS_AVAILABLE';
                else if (occEnum === 2) occupancyStatus = 'FEW_SEATS_AVAILABLE';
                else if (occEnum === 3) occupancyStatus = 'STANDING_ROOM_ONLY';
                else if (occEnum === 4) occupancyStatus = 'CRUSHED_STANDING_ROOM_ONLY';
                else if (occEnum === 5) occupancyStatus = 'FULL';
                else if (occEnum === 6) occupancyStatus = 'NOT_ACCEPTING_PASSENGERS';

                // Infer operator for 'sweden' feed to enable static GTFS resolution
                let effectiveOperator = operatorId;
                if (operatorId === 'sweden') {
                    // 1. Try ID prefix (Most reliable for known agency IDs, tripId/routeId are best)
                    const idOp = inferOperatorFromId(tripId) || inferOperatorFromId(routeId) || inferOperatorFromId(vehicleId);
                    if (idOp) {
                        effectiveOperator = idOp;
                    } else {
                        // 2. Fallback to Geo
                        effectiveOperator = getRegionalOperator(lat, lng);
                    }
                }

                // ── Infer transport mode from routeId NeTEx patterns ──────────────
                // GTFS-RT PBF rarely includes route_type directly; we must infer it.
                // vehicleLabel for trams/trains is often set by the operator.
                const transportMode = inferModeFromRouteId(routeId);

                vehicles.push({
                    id: vehicleId,
                    line,
                    direction: undefined, // Let UI handle missing dest (resolve via GTFS)
                    lat,
                    lng,
                    bearing: pos.bearing ?? 0,
                    speed: pos.speed != null ? Math.round(pos.speed * 3.6) : undefined, // m/s → km/h
                    type: transportMode, // Inferred mode, not always 'BUS'
                    operator: effectiveOperator,
                    tripId,
                    routeId,
                    vehicleLabel,
                    currentStatus,
                    stopId: v.stopId ?? undefined,
                    stopSequence: v.currentStopSequence ?? undefined,
                    occupancyStatus,
                    timestamp: v.timestamp != null ? Number(v.timestamp) : undefined,
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


