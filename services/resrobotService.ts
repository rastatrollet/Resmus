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
            const url = `${API_URLS.RESROBOT_API}/departureBoard?id=${stationId}&duration=${duration}&accessId=${API_KEYS.RESROBOT_API_KEY}&format=json&maxJourneys=500`;
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
                else if (product?.catCode === '8' || product?.catCode === '3') transportType = 'bus'; // Express bus?

                // Clean Destination: Remove city name if it matches station's city
                let direction = item.direction.split('(')[0].trim();
                const stationName = item.stop || "";
                // Heuristic: First word of station is city.
                const city = stationName.split(' ')[0];
                if (city && direction.startsWith(city + " ") && city.length > 2) {
                    direction = direction.substring(city.length + 1);
                }

                // User requested to remove generic operator names in the board
                // We keep it undefined so the UI doesn't render the small gray text under the destination.
                let operator = undefined;
                // Exception: If we really want "Pågatågen" etc, we can keep it, but user said "Ta bort".
                // Safest to just hide it completely as requested.

                // Journey Ref
                let journeyRef = item.JourneyDetailRef?.ref;
                if (journeyRef) journeyRef = "resrobot:" + journeyRef;

                return {
                    id: `${item.name}-${item.date}-${item.time}`,
                    line: product?.num || item.name.replace(/\D/g, ''),
                    direction: direction,
                    stopPoint: { name: item.stop, gid: stationId },
                    time: item.time.substring(0, 5),
                    timestamp: `${item.date}T${item.time}`,
                    datetime: `${item.date}T${item.time}`,
                    // Check rtTime and ensure it's formatted HH:MM
                    realtime: item.rtTime ? item.rtTime.substring(0, 5) : null,
                    rtDate: item.rtDate,
                    bgColor: null,
                    fgColor: null,
                    provider: Provider.RESROBOT,
                    type: transportType,
                    // Check both predicted track (rtTrack) and planned track (track)
                    track: item.rtTrack || item.track || '',
                    status: 'ON_TIME',
                    hasDisruption: false,
                    operator: operator,
                    journeyRef: journeyRef
                };
            });
        } catch (e) {
            console.error("Resrobot departures error:", e);
            return [];
        }
    },

    getJourneyDetails: async (ref: string): Promise<any[]> => {
        if (!ref) return [];
        try {
            let url = ref;

            // If ref is not a full URL (doesn't start with http), construct it
            if (!url.startsWith('http')) {
                // But wait, the API ref is usually a URL. If it's just an encoded URI component or ID?
                // Usually it is a full URL. If not, we might need to prepend base.
                // However, the test output "Proxy fetch failed" implies it IS a URL (since proxy tried to fetch it).
                // Let's assume it is a URL, but safeguard just in case.
                if (url.includes('/journeyDetail')) {
                    url = API_URLS.RESROBOT_API + url; // Unlikely case
                }
            }

            // Ensure accessId is present
            if (!url.includes('accessId=')) {
                url += (url.includes('?') ? '&' : '?') + `accessId=${API_KEYS.RESROBOT_API_KEY}`;
            }

            const res = await fetchWithCors(url);
            if (!res.ok) return [];
            const data = await res.json();

            // ResRobot JourneyDetail structure can be tricky.
            // Often it is JourneyDetail -> Stops -> Stop (array or object)

            const journeyDetail = data.JourneyDetail || data.JourneyLocation || (Array.isArray(data) ? data[0]?.JourneyDetail : null);

            if (!journeyDetail) return [];

            // Sometimes Stops is directly under JourneyDetail
            let stops = journeyDetail.Stops?.Stop;

            if (!stops) return [];

            const list = Array.isArray(stops) ? stops : [stops];

            return list.map((s: any) => {
                const fmt = (t: string | undefined) => t ? t.substring(0, 5) : undefined;

                return {
                    name: s.name,
                    time: (s.depTime || s.arrTime || "").substring(0, 5),
                    arrivalTime: fmt(s.arrTime),
                    departureTime: fmt(s.depTime),
                    realtimeArrival: fmt(s.rtArrTime),
                    realtimeDeparture: fmt(s.rtDepTime),
                    date: s.depDate || s.arrDate,
                    track: s.rtTrack || s.track,
                    isCancelled: s.cancelled,
                    isDeparture: !!s.depTime,
                    coords: (s.lat && s.lon) ? { lat: parseFloat(s.lat), lng: parseFloat(s.lon) } : undefined
                };
            });

        } catch (e) {
            console.error("ResRobot JourneyDetails Error", e);
            return [];
        }
    },

    planTrip: async (originId: string, destId: string, dateTime?: string): Promise<Journey[]> => {
        console.log("ResRobot trip planning not implemented yet");
        return [];
    }
};
