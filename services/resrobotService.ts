import { Departure, Provider, Station, Journey } from '../types';
import { API_KEYS, API_URLS } from './config';

const fetchWithCors = async (url: string) => {
    // If using local proxy (starts with /), fetch directly.
    if (url.startsWith('/')) {
        const targetUrl = `${url}${url.includes('?') ? '&' : '?'}_t=${Date.now()}`;
        return fetch(targetUrl);
    }
    const targetUrl = `${url}${url.includes('?') ? '&' : '?'}_t=${Date.now()}`;
    const proxyUrl = "https://corsproxy.io/?" + encodeURIComponent(targetUrl);
    return fetch(proxyUrl);
};

export const ResrobotService = {
    searchStations: async (query: string): Promise<Station[]> => {
        if (!query) return [];
        console.log("Resrobot searching for:", query);
        try {
            // Note the extra ? for fuzzy search as per user request
            const url = `${API_URLS.RESROBOT_API}/location.name?input=${encodeURIComponent(query)}&maxNo=50&accessId=${API_KEYS.RESROBOT_API_KEY}&format=json`;
            console.log("Fetching URL:", url);

            const res = await fetchWithCors(url);
            console.log("Response status:", res.status);

            if (!res.ok) {
                console.error("Resrobot fetch failed:", res.statusText);
                return [];
            }
            const data = await res.json();
            console.log("Resrobot data:", JSON.stringify(data));

            if (data.errorCode) {
                console.error("ResRobot API Error:", data.errorCode, data.errorText);
                return [];
            }

            // ResRobot structure handling
            let locations: any[] = [];

            if (data.stopLocationOrCoordLocation && Array.isArray(data.stopLocationOrCoordLocation)) {
                locations = data.stopLocationOrCoordLocation
                    .map((item: any) => item.StopLocation || item.CoordLocation)
                    .filter((item: any) => item);
            }
            else if (Array.isArray(data)) locations = data;
            else if (Array.isArray(data.StopLocation)) locations = data.StopLocation;
            else if (data.StopLocation) locations = [data.StopLocation]; // Single object
            else if (data.LocationList?.StopLocation) {
                locations = Array.isArray(data.LocationList.StopLocation)
                    ? data.LocationList.StopLocation
                    : [data.LocationList.StopLocation];
            }

            return locations.map((item: any) => ({
                id: item.extId || item.id,
                gid: item.extId || item.id,
                name: item.name,
                provider: Provider.RESROBOT,
                coords: { lat: parseFloat(item.lat), lng: parseFloat(item.lon) },
                favorite: false
            }));
        } catch (e) {
            console.error("Resrobot search error:", e);
            return [];
        }
    },

    getDepartures: async (stationId: string, duration = 60): Promise<Departure[]> => {
        try {
            const url = `${API_URLS.RESROBOT_API}/departureBoard?id=${stationId}&duration=${duration}&accessId=${API_KEYS.RESROBOT_API_KEY}&format=json&maxJourneys=300`;
            const res = await fetchWithCors(url);
            if (!res.ok) return [];
            const data = await res.json();

            if (!data.Departure) return [];

            const departures = Array.isArray(data.Departure) ? data.Departure : [data.Departure];

            return departures.map((item: any) => {
                let transportType: 'bus' | 'train' | 'tram' | 'ferry' | 'taxi' = 'bus';
                // Product can be object or array
                const product = Array.isArray(item.Product) ? item.Product[0] : item.Product;

                if (product?.catCode === '1') transportType = 'train';
                else if (product?.catCode === '4') transportType = 'tram';
                else if (product?.catCode === '5') transportType = 'bus';

                return {
                    id: `${item.name}-${item.date}-${item.time}`,
                    line: product?.num || item.name.replace(/\D/g, ''),
                    direction: item.direction,
                    stopPoint: { name: item.stop, gid: stationId },
                    time: item.time.substring(0, 5),
                    timestamp: `${item.date}T${item.time}`,
                    datetime: `${item.date}T${item.time}`,
                    realtime: item.rtTime?.substring(0, 5) || null,
                    rtDate: item.rtDate,
                    bgColor: null, // Let frontend decide based on operator
                    fgColor: null,
                    provider: Provider.RESROBOT,
                    type: transportType,
                    track: item.track || '',
                    status: 'ON_TIME',
                    hasDisruption: false,
                    operator: product?.operator || item.Operator?.name || 'ResRobot' // Capture operator
                };
            });
        } catch (e) {
            console.error("Resrobot departures error:", e);
            return [];
        }
    },

    planTrip: async (originId: string, destId: string, dateTime?: string): Promise<Journey[]> => {
        console.log("ResRobot trip planning not implemented yet");
        return [];
    }
};
