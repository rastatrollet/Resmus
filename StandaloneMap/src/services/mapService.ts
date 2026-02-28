
import { API_KEYS, API_URLS } from './config';
import { TrafiklabService } from './trafiklabService';

// -- INTERNAL HELPERS --
// Note: These helper functions (fetchWithCors, getVasttrafikToken) are duplicated from transitService.
// Ideally they should be in a shared 'apiUtils.ts' or similar. 
// For now, to respect "Separera helt" (Separate completely), I'll copy the necessary parts or import them if exposed.
// Since getVasttrafikToken is internal in transitService, I'll need to duplicate or refactor.
// To avoid breaking transitService by extensive refactor, I will duplicate the token logic here for the MapService 
// or stick to using public APIs where possible. 
// Actually, I can export getVasttrafikToken from transitService? No, it's not exported.
// I will create a robust token fetcher here too.

const TOKEN_STORAGE_KEY = 'vt_access_token';
let vtToken: string | null = null;
let vtTokenExpiry: number = 0;

const fetchWithCors = async (url: string, options: RequestInit = {}) => {
    // Basic CORS proxy wrapper
    const targetUrl = `${url}${url.includes('?') ? '&' : '?'}_t=${Date.now()}`;
    const proxyUrl = "https://corsproxy.io/?" + encodeURIComponent(targetUrl);
    return fetch(proxyUrl, options);
};

const getVasttrafikToken = async (): Promise<string | null> => {
    if (vtToken && Date.now() < vtTokenExpiry) return vtToken;

    try {
        const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
        if (stored) {
            const { token, expiry } = JSON.parse(stored);
            if (Date.now() < expiry) {
                vtToken = token;
                vtTokenExpiry = expiry;
                return token;
            }
        }
    } catch (e) { }

    if (!API_KEYS.VASTTRAFIK_AUTH) return null;

    // Retry Logic
    const proxies = [
        (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
        (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}` // specific fallback for post
    ];

    for (const proxyGen of proxies) {
        try {
            const finalUrl = proxyGen(API_URLS.VASTTRAFIK_TOKEN);
            const res = await fetch(finalUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': `Basic ${API_KEYS.VASTTRAFIK_AUTH.trim()}`
                },
                body: 'grant_type=client_credentials'
            });

            if (res.ok) {
                const data = await res.json();
                if (data.access_token) {
                    vtToken = data.access_token;
                    vtTokenExpiry = Date.now() + (data.expires_in * 1000) - 30000;
                    localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify({ token: vtToken, expiry: vtTokenExpiry }));
                    return vtToken;
                }
            }
        } catch (e) { console.warn("MapService Auth Error", e); }
    }
    return null;
};

// -- MAP SERVICE --

export const MapService = {

    /**
     * Get live vehicle positions for the map.
     * Delegates to TrafiklabService for GTFS-RT data.
     */
    getVehiclePositions: async (minLat: number, minLng: number, maxLat: number, maxLng: number, operatorId?: string): Promise<any[]> => {
        // Fetch Trafiklab Sweden (Broad coverage) or Specific operator
        // This is much lighter than V4 positions and gives trip_ids.

        let tlVehicles: any[] = [];
        if (minLat && minLng && maxLat && maxLng) {
            const op = operatorId || 'sweden';
            tlVehicles = await TrafiklabService.getLiveVehicles(op, { minLat, minLng, maxLat, maxLng });
        }

        // Map Trafiklab vehicles to internal Map schema
        const tlMapped = tlVehicles.map(v => ({
            id: `tl-${v.id}`,
            lat: v.lat,
            lng: v.lng,
            bearing: v.bearing,
            speed: v.speed,
            line: v.line,
            dest: v.direction, // Will be mapped to tripHeadsign later
            // Preserve the inferred transport mode — do NOT force 'BUS'!
            // TrafiklabService.getLiveVehicles() now infers this from routeId NeTEx patterns.
            transportMode: v.type || 'BUS',
            detailsReference: null,
            timestamp: v.timestamp ?? (Date.now() / 1000),
            // GTFS-RT trip linkage – pass through for shape resolution
            tripId: v.tripId,
            routeId: v.routeId,
            vehicleLabel: v.vehicleLabel,
            currentStatus: v.currentStatus,
            stopId: v.stopId,
            stopSequence: v.stopSequence,
            occupancyStatus: v.occupancyStatus,
            operator: v.operator,
        }));

        return tlMapped;
    },

    /**
     * Get Stops for the map (Västtrafik Geometry Search).
     */
    getMapStopAreas: async (minLat: number, minLng: number, maxLat: number, maxLng: number): Promise<any[]> => {
        const token = await getVasttrafikToken();
        if (!token) return [];

        // Construct WKT Polygon
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
                lat: sa.geometry?.y, // Y is Latitude
                lng: sa.geometry?.x, // X is Longitude
                municipality: sa.municipality?.name
            })).filter((s: any) => s.lat && s.lng);

        } catch (e) {
            console.error("MapService: Geo Fetch Error", e);
            return [];
        }
    },

    /**
     * Get Parkings (Västtrafik SPP).
     */
    getParkings: async (minLat: number, minLng: number, maxLat: number, maxLng: number): Promise<any[]> => {
        const token = await getVasttrafikToken();
        if (!token) return [];

        const centerLat = (minLat + maxLat) / 2;
        const centerLng = (minLng + maxLng) / 2;

        // Radius rough estimation
        const heightDeg = maxLat - minLat;
        const radiusM = Math.ceil((heightDeg * 111000) / 2) + 2000;

        const url = `${API_URLS.VASTTRAFIK_SPP_API}/parkingAreas?latitude=${centerLat}&longitude=${centerLng}&radius=${Math.min(radiusM, 10000)}`;

        try {
            const res = await fetchWithCors(url, { headers: { 'Authorization': `Bearer ${token}` } });
            if (!res.ok) return [];
            const data = await res.json();

            if (!Array.isArray(data)) return [];

            return data.map((pa: any) => {
                const capacity = pa.parkingCapacity?.total || pa.capacity || '?';
                return {
                    id: pa.id || pa.gid,
                    name: pa.name || "Parkering",
                    lat: pa.location?.latitude,
                    lng: pa.location?.longitude,
                    capacity,
                    cameras: pa.cameras || []
                };
            }).filter(p => p.lat && p.lng);

        } catch (e) {
            console.error("MapService: SPP Parking Error", e);
            return [];
        }
    },

    /**
     * Get Parking Image.
     */
    getParkingImage: async (id: string, camera: number): Promise<string | null> => {
        const token = await getVasttrafikToken();
        if (!token) return null;

        const url = `${API_URLS.VASTTRAFIK_SPP_API}/parkingImages/${id}/${camera}`;

        try {
            const res = await fetchWithCors(url, { headers: { 'Authorization': `Bearer ${token}` } });

            if (!res.ok) {
                // Fallback logic
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

            const blob = await res.blob();
            return URL.createObjectURL(blob);

        } catch (e) {
            console.error("MapService: Parking Image Error", e);
            return null;
        }
    },

    /**
     * Get Traffic Disruptions (Trafikverket).
     * Proxies to TransitService or implements directly?
     * The user asked for isolation. Let's implement getting disruptions directly here or use a dedicated helper.
     * We'll implement a clean fetch for disruptions here to be self-contained.
     */
    getDisruptions: async (): Promise<any[]> => {
        // We can use the generic TrafikverketService if available, or just keeping it simple.
        // Let's import TrafikverketService dynamically to avoid circular dep issues if any.
        const { TrafikverketService } = await import('./trafikverketService');
        const raw = await TrafikverketService.getDisruptions();

        return raw.map(r => ({
            situationNumber: r.id,
            creationTime: r.updatedTime,
            startTime: r.startTime,
            endTime: r.endTime,
            severity: r.severity,
            title: r.title,
            description: r.description,
            coordinates: r.geometry // TrafikverketService should return geometry if updated
        }));
    }
};
