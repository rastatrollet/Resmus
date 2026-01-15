
import { API_KEYS, API_URLS } from './config';

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
    getLiveVehicles: async (operatorId: string): Promise<VehiclePosition[]> => {
        if (!API_KEYS.TRAFIKLAB_API_KEY) {
            console.warn("Missing TRAFIKLAB_API_KEY in config.ts");
            return [];
        }

        // GTFS Regional Realtime URL with format=json for easier parsing in browser
        // If operatorId is empty, we don't have a specific feed to fetch (GTFS Regional is per-operator)
        if (!operatorId) return [];

        const url = `https://opendata.samtrafiken.se/gtfs-rt/${operatorId}/VehiclePositions.pb?key=${API_KEYS.TRAFIKLAB_API_KEY}&format=JSON`;

        try {
            const res = await fetchWithCors(url, { headers: { 'Accept': 'application/json' } });
            if (!res.ok) {
                console.error("GTFS-RT fetch failed:", res.status, res.statusText);
                return [];
            }

            let data;
            const text = await res.text();
            try {
                data = JSON.parse(text);
            } catch (jsonErr) {
                console.error("Failed to parse JSON response. Raw text snippet:", text.substring(0, 100));
                console.warn("If the snippet above looks like binary, format=JSON is not working.");
                return [];
            }





            // GTFS-RT JSON can have various structures depending on the converter
            const entities = data?.entity || data?.entities || data?.FeedEntity || [];

            if (!entities || !Array.isArray(entities)) {
                console.warn("No entities found in GTFS-RT feed. Data:", data);
                return [];
            }

            const vehicles: VehiclePosition[] = [];

            entities.forEach((entity: any) => {
                // Handle different possible keys for vehicle position
                const v = entity.vehicle || entity.VehiclePosition || entity.vehicle_position;
                if (!v) return;

                const pos = v.position || v.Position;
                if (!pos) return;

                const trip = v.trip || v.Trip;
                const vehicle = v.vehicle || v.Vehicle;


                // GTFS-RT JSON often has lowercase, snake_case, or PascalCase keys
                const lat = pos.latitude || pos.lat || pos.Latitude || pos.Lat;
                const lng = pos.longitude || pos.lng || pos.Longitude || pos.Lng;

                if (lat === undefined || lng === undefined) return;

                // Mapping route_id to line
                let line = trip?.route_id || trip?.routeId || trip?.RouteId || vehicle?.label || vehicle?.Label || "?";

                // Clean up line
                if (typeof line === 'string' && line.length > 10) {
                    const label = vehicle?.label || vehicle?.Label;
                    if (label && typeof label === 'string' && label.length < 10) {
                        line = label;
                    }
                }

                vehicles.push({
                    id: vehicle?.id || vehicle?.Id || entity.id || entity.Id || Math.random().toString(),
                    line: String(line),
                    direction: "Se rutt",
                    lat: parseFloat(lat),
                    lng: parseFloat(lng),
                    bearing: pos.bearing || pos.Bearing || 0,
                    speed: pos.speed || pos.Speed,
                    type: 'BUS',
                    operator: operatorId
                });

            });

            return vehicles;
        } catch (e) {
            console.error("Error fetching GTFS-RT positions:", e);
            return [];
        }
    }
};


