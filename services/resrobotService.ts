import { Departure, Provider, Station, Journey } from '../types';
import { API_KEYS, API_URLS } from './config';

const fetchWithCors = async (url: string) => {
    const targetUrl = `${url}${url.includes('?') ? '&' : '?'}_t=${Date.now()}`;
    const proxyUrl = "https://corsproxy.io/?" + encodeURIComponent(targetUrl);
    return fetch(proxyUrl);
};

export const ResrobotService = {
    searchStations: async (query: string): Promise<Station[]> => {
        if (!query) return [];
        try {
            const url = `${API_URLS.RESROBOT_API}/location.name.json?input=${encodeURIComponent(query)}&maxNo=50&accessId=${API_KEYS.RESROBOT_API_KEY}&format=json`;
            const res = await fetchWithCors(url);
            if (!res.ok) return [];
            const data = await res.json();

            if (!data.StopLocation) return [];

            // Handle single object or array
            const locations = Array.isArray(data.StopLocation) ? data.StopLocation : [data.StopLocation];

            return locations.map((item: any) => ({
                id: item.id,
                name: item.name,
                provider: Provider.RESROBOT,
                coords: { lat: item.lat, lng: item.lon }
            }));
        } catch (e) {
            console.error("Resrobot search error:", e);
            return [];
        }
    },

    getDepartures: async (stationId: string, duration = 60): Promise<Departure[]> => {
        try {
            const url = `${API_URLS.RESROBOT_API}/departureBoard.json?id=${stationId}&duration=${duration}&accessId=${API_KEYS.RESROBOT_API_KEY}&format=json&maxJourneys=300`;
            const res = await fetchWithCors(url);
            if (!res.ok) return [];
            const data = await res.json();

            if (!data.Departure) return [];

            const departures = Array.isArray(data.Departure) ? data.Departure : [data.Departure];

            return departures.map((item: any) => ({
                id: `${item.name}-${item.date}-${item.time}`,
                line: item.Product?.num || item.name.replace(/\D/g, ''),
                direction: item.direction,
                stopPoint: { name: item.stop, gid: stationId },
                time: item.time.substring(0, 5),
                timestamp: `${item.date}T${item.time}`,
                realtime: item.rtTime?.substring(0, 5) || null,
                rtDate: item.rtDate,
                bgColor: '#475569', // Default Slate
                fgColor: '#ffffff',
                provider: Provider.RESROBOT,
                type: item.Product?.catCode === '1' ? 'train' :
                    item.Product?.catCode === '5' ? 'bus' :
                        item.Product?.catCode === '4' ? 'tram' : 'bus', // heuristic
                track: item.track
            }));
        } catch (e) {
            console.error("Resrobot departures error:", e);
            return [];
        }
    },

    planTrip: async (originId: string, destId: string, dateTime?: string): Promise<Journey[]> => {
        // Basic placeholder or implementation if needed
        // For now return empty as user focus is on Departures
        return [];
    }
};
