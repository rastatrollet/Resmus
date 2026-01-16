import { Departure, Provider, Station } from '../types';
import { API_KEYS, API_URLS } from './config';

// Helper for CORS requests
const fetchWithCors = async (url: string, options: RequestInit = {}) => {
    const targetUrl = `${url}${url.includes('?') ? '&' : '?'}_t=${Date.now()}`;
    const proxyUrl = "https://corsproxy.io/?" + encodeURIComponent(targetUrl);
    return fetch(proxyUrl, options);
};

export const ResrobotService = {
    searchStations: async (query: string): Promise<Station[]> => {
        if (!API_KEYS.RESROBOT_API_KEY) {
            console.warn("Missing RESROBOT_API_KEY");
            return [];
        }

        const url = `${API_URLS.RESROBOT_API}/location.name?input=${encodeURIComponent(query)}&format=json&accessId=${API_KEYS.RESROBOT_API_KEY}`;

        try {
            const res = await fetchWithCors(url);
            if (!res.ok) return [];
            const data = await res.json();

            if (!data.StopLocation || !Array.isArray(data.StopLocation)) return [];

            return data.StopLocation.map((stop: any) => ({
                id: stop.id, // Resrobot uses 'id' (e.g. 740000001)
                name: stop.name,
                provider: Provider.RESROBOT,
                coords: { lat: stop.lat, lng: stop.lon }
            }));
        } catch (e) {
            console.error("Resrobot Search Error", e);
            return [];
        }
    },

    getDepartures: async (stationId: string, duration = 60): Promise<Departure[]> => {
        if (!API_KEYS.RESROBOT_API_KEY) return [];

        // limit to 50 results to not overwhelm
        const url = `${API_URLS.RESROBOT_API}/departureBoard?id=${stationId}&duration=${duration}&format=json&accessId=${API_KEYS.RESROBOT_API_KEY}&maxJourneys=50`;

        try {
            const res = await fetchWithCors(url);
            if (!res.ok) return [];
            const data = await res.json();

            if (!data.Departure || !Array.isArray(data.Departure)) return [];

            return data.Departure.map((dep: any) => {
                // Map Resrobot Product to Type
                let type: 'BUS' | 'TRAM' | 'TRAIN' | 'FERRY' | 'METRO' | 'UNK' = 'BUS';
                const cat = dep.ProductAtStop?.catOutL || dep.ProductAtStop?.catOutS; // e.g. "Buss", "Tåg", "BLT"
                const prodName = dep.name || "";

                if (cat === 'Tåg' || cat === 'Jlt' || cat === 'Re' || prodName.includes('Tåg')) type = 'TRAIN';
                else if (cat === 'Spårvagn' || prodName.includes('Spårvagn')) type = 'TRAM';
                else if (cat === 'T-bana' || cat === 'Metro') type = 'METRO';
                else if (cat === 'Färja' || cat === 'Båt' || prodName.includes('Båt')) type = 'FERRY';

                // Colors? Resrobot doesn't give colors directly usually. We'll use defaults in UI.

                // Time logic
                const date = dep.date; // YYYY-MM-DD
                const time = dep.time; // HH:MM:SS
                const datetime = `${date}T${time}`;

                // Realtime
                const rtDate = dep.rtDate;
                const rtTime = dep.rtTime;
                let realtimeTimestamp = undefined;
                let realtime = undefined;
                let status: 'ON_TIME' | 'LATE' | 'CANCELLED' | 'EARLY' = 'ON_TIME';

                if (rtDate && rtTime) {
                    realtimeTimestamp = `${rtDate}T${rtTime}`;
                    realtime = rtTime.substring(0, 5);

                    if (dep.cancelled) status = 'CANCELLED';
                    else if (realtimeTimestamp !== datetime) status = 'LATE'; // Simplified
                }

                return {
                    id: `rr-${dep.JourneyDetailRef?.ref || Math.random()}`,
                    line: dep.ProductAtStop?.displayNumber || dep.ProductAtStop?.num || "?",
                    direction: dep.direction,
                    time: time.substring(0, 5),
                    datetime: datetime,
                    timestamp: datetime, // Should be full ISO but this mimics local somewhat
                    realtime: realtime,
                    stopPoint: { name: dep.stop, gid: stationId },
                    track: dep.track || "",
                    provider: Provider.RESROBOT,
                    status: status,
                    journeyRef: dep.JourneyDetailRef?.ref,
                    type: type
                } as Departure;
            });

        } catch (e) {
            console.error("Resrobot Departure Error", e);
            return [];
        }
    }
};
