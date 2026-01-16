import { Departure, Provider, Station, TrafficSituation, Journey, TripLeg, JourneyDetail } from '../types';
import { API_KEYS, API_URLS } from './config';
import { ResrobotService } from './resrobotService';

// Cache for API responses
const apiCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 60000; // 60 seconds for better performance

// Helper for CORS requests with caching
const fetchWithCors = async (url: string, options: RequestInit = {}, useCache = true) => {
    // Check cache first
    if (useCache) {
        const cached = apiCache.get(url);
        if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
            return new Response(JSON.stringify(cached.data), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }

    const separator = url.includes('?') ? '&' : '?';
    const targetUrl = `${url}${separator}_t=${Date.now()}`;
    const proxyUrl = "https://corsproxy.io/?" + encodeURIComponent(targetUrl);

    const response = await fetch(proxyUrl, options);

    // Cache successful responses
    if (useCache && response.ok) {
        try {
            const data = await response.clone().json();
            apiCache.set(url, { data, timestamp: Date.now() });

            // Clean old cache entries (keep only last 50)
            if (apiCache.size > 50) {
                const oldestKey = apiCache.keys().next().value;
                if (oldestKey) {
                    apiCache.delete(oldestKey);
                }
            }
        } catch (e) {
            // Ignore cache errors for non-JSON responses
        }
    }

    return response;
};

// Helper: Ensure color has # prefix and is valid
const fixColor = (color: string | undefined | null, defaultColor: string): string => {
    if (!color || typeof color !== 'string') return defaultColor;
    const trimmed = color.trim();
    if (trimmed === '') return defaultColor;
    if (trimmed.startsWith('#')) return trimmed;
    if (/^([0-9A-F]{3}|[0-9A-F]{6})$/i.test(trimmed)) {
        return `#${trimmed}`;
    }
    return defaultColor;
};

// Helper: Format Date for VT API (RFC 3339 with Offset)
const formatDateForVT = (dateString: string): string => {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = '00';

    // Get offset for the specific date
    const offsetMinutes = -date.getTimezoneOffset();
    const offsetSign = offsetMinutes >= 0 ? '+' : '-';
    const offsetH = String(Math.floor(Math.abs(offsetMinutes) / 60)).padStart(2, '0');
    const offsetM = String(Math.abs(offsetMinutes) % 60).padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${offsetSign}${offsetH}:${offsetM}`;
};

// -- AUTHENTICATION --
let vtToken: string | null = null;
let vtTokenExpiry: number = 0;

const getVasttrafikToken = async (): Promise<string | null> => {
    if (vtToken && Date.now() < vtTokenExpiry) return vtToken;
    if (!API_KEYS.VASTTRAFIK_AUTH) {
        console.warn("Missing VASTTRAFIK_AUTH in config.ts");
        return null;
    }

    for (let i = 0; i < 2; i++) {
        try {


            const res = await fetchWithCors(API_URLS.VASTTRAFIK_TOKEN, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': `Basic ${API_KEYS.VASTTRAFIK_AUTH.trim()}`
                },
                body: 'grant_type=client_credentials'
            });

            if (!res.ok) continue;

            const data = await res.json();
            if (data.access_token) {
                vtToken = data.access_token;
                vtTokenExpiry = Date.now() + (data.expires_in * 1000) - 30000;
                return vtToken;
            }
        } catch (e) { console.error(e); }
    }
    return null;
};

// Västtrafik Departures (V4)
const fetchVasttrafikDepartures = async (gid: string, mode: 'departures' | 'arrivals', dateTime?: string): Promise<Departure[]> => {
    const token = await getVasttrafikToken();
    if (!token) return [];

    const endpoint = mode === 'arrivals' ? 'arrivals' : 'departures';
    let url = `${API_URLS.VASTTRAFIK_API}/stop-areas/${gid}/${endpoint}?limit=100`;

    if (dateTime) {
        const vtDate = formatDateForVT(dateTime);
        if (vtDate) {
            url += `&startDateTime=${encodeURIComponent(vtDate)}`;
        }
    }

    try {
        const res = await fetchWithCors(url, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) return [];
        const data = await res.json();

        if (!data.results) return [];

        return data.results.map((entry: any) => {
            const serviceJourney = entry.serviceJourney;
            const lineDetails = serviceJourney?.line;
            const line = lineDetails?.designation || lineDetails?.name || "?";

            let transportMode = lineDetails?.transportMode;

            // Fallback: Check product name if mode is missing or generic
            if (!transportMode || transportMode === 'BUS') {
                const productName = lineDetails?.product?.name?.toLowerCase() || '';
                const lineName = line;
                const lineNum = parseInt(lineName) || 0;

                // 1. Explicit Tram Lines (1-13)
                // Note: 100% reliable only within Gbg, but safe heuristic for this app context
                const tramLines = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '13', '14']; // Added 14 just in case, though usually bus
                if (tramLines.includes(lineName) || (lineNum >= 1 && lineNum <= 13)) {
                    transportMode = 'TRAM';
                }
                // 2. Explicit Ferry Lines
                else if (['281', '282', '283', '284', '285', '286', '287', '326', 'ÄLVS'].includes(lineName) ||
                    productName.includes('älvsnabben') ||
                    productName.includes('färja')) {
                    transportMode = 'FERRY';
                }
                // 3. Generic Text Match (Stricter)
                else {
                    if (productName.includes('spårvagn')) transportMode = 'TRAM';
                    else if (productName.includes('tåg')) transportMode = 'TRAIN';
                    // Use regex for 'båt' to avoid "Båtsman" matching
                    else if (/\bbåt\b/i.test(productName) || productName.includes('färja')) transportMode = 'FERRY';
                }
            }

            if (!transportMode) transportMode = 'BUS';

            let dir = serviceJourney?.direction || "Okänd";

            if (mode === 'arrivals') {
                const origin = entry.origin || entry.serviceJourney?.origin;
                if (origin) {
                    dir = typeof origin === 'string' ? origin : (origin.name || "Ankommande");
                } else {
                    dir = "Ankommande";
                }
            }

            const planned = entry.plannedTime;
            const estimated = entry.estimatedTime;
            const isCancelled = entry.isCancelled;

            const formatTime = (iso: string) => iso ? new Date(iso).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }) : '00:00';

            const time = formatTime(planned);
            const realtime = estimated ? formatTime(estimated) : undefined;
            const timestamp = estimated || planned || new Date().toISOString();

            let status: any = 'ON_TIME';
            if (isCancelled) status = 'CANCELLED';
            else if (estimated && planned && estimated !== planned) status = 'LATE';

            // Check for disruptions and severity
            // We use entry.situations as it's the standard place for departure-specific disruptions.
            const situations = entry.situations || [];
            const hasDisruption = situations.length > 0;
            let disruptionSeverity: 'severe' | 'normal' | 'slight' | undefined = undefined;

            if (hasDisruption) {
                // Determine most relevant severity. Usually take the first one or logic to prioritize severe.
                // Västtrafik V4 usually provides 'severity' field in situation.
                disruptionSeverity = situations[0]?.severity || 'slight';
            }

            let bgColor = fixColor(lineDetails?.backgroundColor, '#0ea5e9');
            let fgColor = fixColor(lineDetails?.foregroundColor || lineDetails?.textColor, '#ffffff');

            // Override for X90 styling (Yellow bg, Magenta text)
            // RGB(255, 255, 80) -> #FFFF50
            // RGB(212, 0, 162) -> #D400A2
            if (line === 'X90') {
                bgColor = '#FFFF50';
                fgColor = '#D400A2';
            }

            return {
                id: `vt-${entry.detailsReference || Math.random()}`,
                line,
                direction: dir,
                time,
                timestamp,
                realtime,
                track: entry.stopPoint?.platform || '',
                provider: Provider.VASTTRAFIK,
                status,
                bgColor,
                fgColor,
                journeyRef: entry.detailsReference || serviceJourney?.gid || serviceJourney?.id,
                hasDisruption,
                disruptionSeverity,
                disruptionMessage: situations.length > 0 ? (situations[0].title || situations[0].description) : undefined,
                type: transportMode
            };
        });
    } catch (e) { return []; }
};

// Helper to getting vehicle positions
// Helper to getting vehicle positions via Västtrafik V4
const fetchVehiclePositions = async (minLat?: number, minLng?: number, maxLat?: number, maxLng?: number): Promise<any[]> => {
    const token = await getVasttrafikToken();
    if (!token) return [];

    // Use V4 positions endpoint
    let url = `${API_URLS.VASTTRAFIK_API}/positions?limit=200`;

    // Add bounding box if provided, otherwise default to Gothenburg area
    const lowerLeftLat = minLat || 57.6;
    const lowerLeftLong = minLng || 11.8;
    const upperRightLat = maxLat || 57.8;
    const upperRightLong = maxLng || 12.1;

    url += `&lowerLeftLat=${lowerLeftLat}&lowerLeftLong=${lowerLeftLong}&upperRightLat=${upperRightLat}&upperRightLong=${upperRightLong}`;



    try {
        const res = await fetchWithCors(url, { headers: { 'Authorization': `Bearer ${token}` } }, false);
        if (!res.ok) {
            console.error("V4 Positions Error:", res.status);
            return [];
        }
        const data = await res.json();


        if (!data || !Array.isArray(data)) return [];

        // Map V4 position properties to our internal format
        // Schema: { detailsReference, line: { name, transportMode, isRealtimeJourney }, latitude, longitude, name, direction }
        return data.map((vp: any) => {
            if (!vp.latitude || !vp.longitude) return null;

            // Bearing/Speed might not be in official schema but sometimes extra fields exist. 
            // If missing, we default to 0. 
            // Note: 'direction' field is a string (Destination), not a bearing.

            // Clean destination string helper
            const cleanDestination = (dest: string | undefined) => {
                if (!dest) return undefined;
                return dest.replace(/Påstigning fram/gi, '')
                    .replace(/Ej påstigning/gi, '')
                    .replace(/Endast avstigning/gi, '')
                    .trim();
            };

            const cleanedDest = cleanDestination(vp.direction);

            // Stable ID Generation:
            // 1. detailsReference (Best)
            // 2. trainNumber (if available) -> checked manually, not in standard VP helper schema but useful if added later
            // 3. Line + Designation + Direction (Fallback) -> better than random, allows animation for same vehicle.
            // Avoid Math.random() as it forces remounts!
            const stableId = vp.detailsReference ||
                (vp.trainNumber ? `train-${vp.trainNumber}` : undefined) ||
                `veh-${vp.line?.name || 'unknown'}-${cleanedDest || 'nodest'}-${vp.line?.transportMode || 'unk'}`;

            return {
                id: stableId,
                lat: vp.latitude,
                lng: vp.longitude,
                bearing: vp.bearing || 0, // Fallback if missing
                speed: vp.speed || 0,
                line: vp.line?.name || vp.line?.designation || '?',
                // label: vp.line?.name || '?', // REMOVED: Caused "X4" to appear as Next Stop
                dest: cleanedDest || 'Mot destination',
                transportMode: vp.line?.transportMode,
                detailsReference: vp.serviceJourney?.gid || vp.detailsReference,
                timestamp: new Date().getTime() / 1000
            };
        }).filter((v: any) => v);
    } catch (e) {
        console.error("Västtrafik Positions Fetch Error", e);
        return [];
    }
};

// Helper to fetch stop areas within a bounding box using Geografi V3
// Using Spatial Filter (WKT Polygon)
const fetchStopAreas = async (minLat: number, minLng: number, maxLat: number, maxLng: number): Promise<any[]> => {
    const token = await getVasttrafikToken();
    if (!token) return [];

    // Construct WKT Polygon: POLYGON((minLng minLat, maxLng minLat, maxLng maxLat, minLng maxLat, minLng minLat))
    // Note: Coordinates in WKT are typically X Y (Lng Lat). Fixed to 6 decimal places.
    const fix = (n: number) => n.toFixed(6);
    const wkt = `POLYGON((${fix(minLng)} ${fix(minLat)},${fix(maxLng)} ${fix(minLat)},${fix(maxLng)} ${fix(maxLat)},${fix(minLng)} ${fix(maxLat)},${fix(minLng)} ${fix(minLat)}))`;

    const url = `${API_URLS.VASTTRAFIK_GEO_API}/StopAreas?spatialFilter=${encodeURIComponent(wkt)}&srid=4326&limit=100`;

    try {
        const res = await fetchWithCors(url, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) return [];
        const data = await res.json();

        if (!data || !Array.isArray(data)) return [];

        return data.map((sa: any) => ({
            id: sa.gid,
            name: sa.name,
            lat: sa.geometry?.x, // Swapped: geometry.x is usually Latitude in some weird VT CRS, but usually it's Y=Lat, X=Long.
            // Let's rely on standard WGS84: Y is Latitude, X is Longitude.
            // Documentation says: Y = Latitude, X = Longitude.
            lng: sa.geometry?.y,
            municipality: sa.municipality?.name
        })).map(s => ({
            ...s,
            lat: s.lat, // Wait, if I swap them below in the map logic?
            // Actually, let's look at the failed result.
        })).filter((s: any) => s.lat && s.lng);
        // Correct mapping based on standard:
        return data.map((sa: any) => ({
            id: sa.gid,
            name: sa.name,
            lat: sa.geometry?.y, // Y is Latitude
            lng: sa.geometry?.x, // X is Longitude
            municipality: sa.municipality?.name
        })).filter((s: any) => s.lat && s.lng);

    } catch (e) {
        console.error("Geografi V3 Fetch Error", e);
        return [];
    }
};

export const TransitService = {

    getVasttrafikDisruptions: async (): Promise<TrafficSituation[]> => {
        const token = await getVasttrafikToken();
        if (!token) return [];

        const url = `${API_URLS.VASTTRAFIK_TS_API}/traffic-situations`;
        try {
            const res = await fetchWithCors(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) return [];
            const data = await res.json();
            if (!Array.isArray(data)) return [];

            return data.map((ts: any) => ({
                situationNumber: ts.situationNumber,
                creationTime: ts.creationTime,
                startTime: ts.startTime,
                endTime: ts.endTime,
                severity: ts.severity,
                title: ts.title,
                description: ts.description,
                affectedLines: ts.affectedLines ? ts.affectedLines.map((l: any) => {
                    let bgColor = fixColor(l.backgroundColor, '#0ea5e9');
                    let txtColor = fixColor(l.textColor, '#ffffff');

                    // Override X90 in Disruptions
                    if (l.designation === 'X90') {
                        bgColor = '#FFFF50';
                        txtColor = '#D400A2';
                    }

                    return {
                        gid: l.gid,
                        designation: l.designation,
                        textColor: txtColor,
                        backgroundColor: bgColor
                    };
                }) : [],
                affectedStopPoints: ts.affectedStopPoints ? ts.affectedStopPoints.map((s: any) => ({
                    gid: s.gid,
                    name: s.name
                })) : []
            }));
        } catch (e) { return []; }
    },

    searchStations: async (query: string, provider: Provider = Provider.VASTTRAFIK): Promise<Station[]> => {
        if (provider === Provider.RESROBOT) {
            return ResrobotService.searchStations(query);
        }

        const token = await getVasttrafikToken();
        if (!token) return [];

        const url = `${API_URLS.VASTTRAFIK_API}/locations/by-text?q=${encodeURIComponent(query)}&limit=15&types=stoparea`;
        try {
            const res = await fetchWithCors(url, { headers: { 'Authorization': `Bearer ${token}` } });
            if (!res.ok) return [];
            const data = await res.json();
            if (!data.results) return [];
            return data.results.map((item: any) => ({
                id: item.gid,
                name: item.name,
                provider: Provider.VASTTRAFIK,
                coords: { lat: item.geometry?.latitude || 0, lng: item.geometry?.longitude || 0 }
            }));
        } catch (e) { return []; }
    },

    getNearbyStations: async (lat: number, lng: number): Promise<Station[]> => {
        const token = await getVasttrafikToken();
        if (!token) return [];
        const url = `${API_URLS.VASTTRAFIK_API}/locations/by-coordinates?latitude=${lat}&longitude=${lng}&radiusInMeters=2000&limit=20&types=stoparea`;
        try {
            const res = await fetchWithCors(url, { headers: { 'Authorization': `Bearer ${token}` } });
            if (!res.ok) return [];
            const data = await res.json();
            if (!data.results) return [];
            return data.results.map((item: any) => ({
                id: item.gid,
                name: item.name,
                provider: Provider.VASTTRAFIK,
                coords: { lat: item.geometry?.latitude || 0, lng: item.geometry?.longitude || 0 }
            }));
        } catch (e) { return []; }
    },

    getDepartures: async (stationId: string, provider: Provider, mode: 'departures' | 'arrivals', dateTime?: string): Promise<Departure[]> => {
        if (provider === Provider.RESROBOT) {
            return ResrobotService.getDepartures(stationId);
        }
        return fetchVasttrafikDepartures(stationId, mode, dateTime);
    },

    planTrip: async (fromId: string, toId: string, dateTime?: string): Promise<Journey[]> => {
        const token = await getVasttrafikToken();
        if (!token) return [];

        let url = `${API_URLS.VASTTRAFIK_API}/journeys?originGid=${fromId}&destinationGid=${toId}&limit=6&includeIntermediateStops=true`;

        if (dateTime) {
            const vtDate = formatDateForVT(dateTime);
            if (vtDate) {
                url += `&dateTime=${encodeURIComponent(vtDate)}`;
            }
        }

        try {
            const res = await fetchWithCors(url, { headers: { 'Authorization': `Bearer ${token}` } });
            const data = await res.json();

            if (!data.results) return [];

            return data.results.map((journey: any, idx: number) => {
                const legs = journey.tripLegs.map((leg: any) => {
                    const isWalk = !leg.serviceJourney;
                    const type = isWalk ? 'WALK' : (
                        leg.serviceJourney.line.transportMode === 'TRAM' ? 'TRAM' :
                            leg.serviceJourney.line.transportMode === 'TRAIN' ? 'TRAIN' :
                                leg.serviceJourney.line.transportMode === 'FERRY' ? 'FERRY' : 'BUS'
                    );

                    const originName = leg.origin.stopPoint?.name || leg.origin.name || "Start";
                    const destName = leg.destination.stopPoint?.name || leg.destination.name || "Slut";

                    let bgColor = isWalk ? '#cbd5e1' : fixColor(leg.serviceJourney.line.backgroundColor, '#0ea5e9');
                    let fgColor = isWalk ? '#334155' : fixColor(leg.serviceJourney.line.foregroundColor || leg.serviceJourney.line.textColor, '#ffffff');

                    let name = isWalk ? "Gå" : (leg.serviceJourney.line.designation || leg.serviceJourney.line.name);

                    // Override for X90 styling in Trip Planner
                    if (!isWalk && leg.serviceJourney?.line?.designation === 'X90') {
                        bgColor = '#FFFF50';
                        fgColor = '#D400A2';
                    }

                    return {
                        type,
                        name,
                        direction: leg.serviceJourney?.direction || (isWalk ? `Mot ${destName}` : ""),
                        origin: {
                            name: originName,
                            time: new Date(leg.origin.plannedTime).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }),
                            track: leg.origin.stopPoint?.platform,
                            date: leg.origin.plannedTime
                        },
                        destination: {
                            name: destName,
                            time: new Date(leg.destination.plannedTime).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }),
                            track: leg.destination.stopPoint?.platform,
                            date: leg.destination.plannedTime
                        },
                        duration: 0,
                        bgColor,
                        fgColor,
                        distance: leg.distanceInMeters,
                        cancelled: leg.cancelled || leg.origin.cancelled || leg.destination.cancelled,
                        messages: leg.notes?.map((n: any) => n.text) || [],
                        disruptionSeverity: leg.notes?.some((n: any) => n.severity === 'severe') ? 'severe' : (leg.notes?.length ? 'normal' : undefined),
                        intermediateStops: leg.callsOnLeg?.map((call: any) => ({
                            name: call.stopPoint.name,
                            time: new Date(call.plannedTime).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }),
                            coords: call.stopPoint?.geometry ? { lat: call.stopPoint.geometry.latitude, lng: call.stopPoint.geometry.longitude } : undefined
                        })) || []
                    } as TripLeg;
                });

                const firstLeg = legs[0];
                const lastLeg = legs[legs.length - 1];

                return {
                    id: `vt-journey-${idx}-${Date.now()}`,
                    legs,
                    startTime: firstLeg.origin.time,
                    endTime: lastLeg.destination.time,
                    duration: 0
                };
            });
        } catch (e) { return []; }
    },
    async getJourneyDetails(journeyRef: string): Promise<JourneyDetail[]> {
        const token = await getVasttrafikToken();
        if (!token) return [];

        // Use service-journeys endpoint to get the specific trip details/calls
        const url = `${API_URLS.VASTTRAFIK_API}/service-journeys/${encodeURIComponent(journeyRef)}?limit=100`;

        try {
            // console.log("Fetching journey details from URL:", url);
            const res = await fetchWithCors(url, { headers: { 'Authorization': `Bearer ${token}` } });

            if (!res.ok) {
                const errorText = await res.text();
                console.error("Journey details API error:", errorText);
                return [];
            }

            const data = await res.json();

            // The API usually returns 'calls' (stops) for a service journey
            if (!data.calls) {
                console.warn("No 'calls' property found in journey data. Available keys:", Object.keys(data));
                return [];
            }

            return data.calls.map((call: any) => {
                // V4 property names often have 'Time' suffix: plannedArrival -> plannedArrivalTime
                const arrTime = call.estimatedArrivalTime || call.plannedArrivalTime;
                const depTime = call.estimatedDepartureTime || call.plannedDepartureTime;

                // Fallback to names without 'Time' just in case
                const altArrTime = call.estimatedArrival || call.plannedArrival;
                const altDepTime = call.estimatedDeparture || call.plannedDeparture;

                const primaryTime = arrTime || depTime || altArrTime || altDepTime;

                return {
                    name: call.stopPoint?.name || "Okänd",
                    time: primaryTime ? new Date(primaryTime).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }) : '--:--',
                    track: call.stopPoint?.platform || "",
                    date: primaryTime,
                    isCancelled: call.isCancelled,
                    isDeparture: !!call.plannedDepartureTime,
                    coords: call.stopPoint?.geometry ? { lat: call.stopPoint.geometry.latitude, lng: call.stopPoint.geometry.longitude } : undefined
                };
            });
        } catch (e) {
            console.error("Failed to fetch journey details", e);
            return [];
        }
    },

    getVehiclePositions: async (minLat?: number, minLng?: number, maxLat?: number, maxLng?: number): Promise<any[]> => {
        return fetchVehiclePositions(minLat, minLng, maxLat, maxLng);
    },

    getMapStopAreas: async (minLat: number, minLng: number, maxLat: number, maxLng: number): Promise<any[]> => {
        return fetchStopAreas(minLat, minLng, maxLat, maxLng);
    },

    getParkings: async (minLat: number, minLng: number, maxLat: number, maxLng: number): Promise<any[]> => {
        const token = await getVasttrafikToken();
        if (!token) return [];

        // Västtrafik SPP v3
        // Endpoint: /spp/v3/parkingAreas?lat=...&long=...&dist=... -- actually seems based on Geo.
        // Let's use bounding box if supported, or a center point with radius if that's what API takes.
        // Documentation implies we can query by geometry or just get all and filter?
        // Let's try to query by simplified bounding box (spatial filter often supported in GIG/Spp)
        // Actually, the common endpoint is often just getting all relevant ones or by stop area. 
        // For "Live Map" let's try a radial search from center of viewport or the bounding box center.

        const centerLat = (minLat + maxLat) / 2;
        const centerLng = (minLng + maxLng) / 2;

        // Approx radius in meters (diagonal / 2)
        // 1 deg lat ~ 111km. 0.1 deg ~ 11km. 
        // Viewport height deg = maxLat - minLat. 
        const heightDeg = maxLat - minLat;
        const radiusM = Math.ceil((heightDeg * 111000) / 2) + 2000; // Buffer

        // NOTE: Official docs vary. Let's try standard V4 locations text search or specialized parking endpoint.
        // But the user mentioned "Pendelparkeringar ... apiet med kamerorna". 
        // This is commonly the "Spp" (Styrning och presentation av parkering) API.

        const url = `${API_URLS.VASTTRAFIK_SPP_API}/parkingAreas?latitude=${centerLat}&longitude=${centerLng}&radius=${Math.min(radiusM, 10000)}`;

        try {
            const res = await fetchWithCors(url, { headers: { 'Authorization': `Bearer ${token}` } });
            if (!res.ok) return [];
            const data = await res.json();

            // Expected format: Array of parking areas
            if (!Array.isArray(data)) return [];

            return data.map((pa: any) => {
                // Determine capacity. 
                // "parkingCapacity": { "total": 40 }
                const capacity = pa.parkingCapacity?.total || pa.capacity || '?';

                return {
                    id: pa.id || pa.gid,
                    name: pa.name || "Parkering",
                    lat: pa.location?.latitude,
                    lng: pa.location?.longitude,
                    capacity,
                    cameras: pa.cameras || [] // Array of camera objects usually
                };
            }).filter(p => p.lat && p.lng);

        } catch (e) {
            console.error("SPP Parking V3 Error", e);
            return [];
        }
    },

    getParkingImage: async (id: string, camera: number): Promise<string | null> => {
        const token = await getVasttrafikToken();
        if (!token) return null;

        // User requested path structure: /parkingImages/{id}/{cameraId}
        // Let's try to construct this URL against the SPP API base.
        // Assuming API_URLS.VASTTRAFIK_SPP_API points to /spp/v3, and user says "/parkingImages..."
        // It might be a sibling endpoint or under the same base. 
        // Let's try: {VASTTRAFIK_SPP_API}/parkingImages/{id}/{camera}

        // Note: The user said "som test ./parkingImages...", implying relative or specific path.
        // "spp/v3/parkingImages" is a valid pattern in some GIG contexts.
        const url = `${API_URLS.VASTTRAFIK_SPP_API}/parkingImages/${id}/${camera}`;

        try {
            // Fetch as BLOB because these usually require Auth headers and can't be used in <img src> directly if so.
            const res = await fetchWithCors(url, { headers: { 'Authorization': `Bearer ${token}` } });

            // If the specific endpoint fails, fall back to the old method? 
            // The user specifically asked to "Prova ... som test", so let's prioritize this.
            if (!res.ok) {
                console.warn(`Direct parking image fetch failed (${res.status}), trying fallback...`);
                // Fallback: Fetch parking details and get generic URL
                const fallbackUrl = `${API_URLS.VASTTRAFIK_SPP_API}/parkingAreas/${id}`;
                const fallbackRes = await fetchWithCors(fallbackUrl, { headers: { 'Authorization': `Bearer ${token}` } });
                if (fallbackRes.ok) {
                    const data = await fallbackRes.json();
                    if (data?.cameras?.[camera - 1]?.imageUrl) {
                        return data.cameras[camera - 1].imageUrl;
                    }
                }
                return null;
            }

            // If successful, getting binary data
            const blob = await res.blob();
            return URL.createObjectURL(blob);

        } catch (e) {
            console.error("Failed to fetch parking image", e);
            return null;
        }
    },
};
