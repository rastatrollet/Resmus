import { API_KEYS } from './config';
import { Departure, Provider } from '../types';

// Helper for CORS requests
const fetchWithCors = async (url: string) => {
    const targetUrl = url;
    const proxyUrl = "https://corsproxy.io/?" + encodeURIComponent(targetUrl);
    // User-Agent is sometimes required by Trafiklab
    return fetch(proxyUrl, {
        headers: {
            'User-Agent': 'Resmus/2.0 (Generic Web App)'
        }
    });
};

export const TrafiklabRealtimeService = {
    getDepartures: async (stationId: string): Promise<Departure[]> => {
        if (!API_KEYS.TRAFIKLAB_API_KEY) {
            console.error("Missing TRAFIKLAB_API_KEY");
            return [];
        }

        // Västtrafik GTFS-RT Trip Updates
        let url = `https://opendata.samtrafiken.se/gtfs-rt/vasttrafik/TripUpdates.pb?key=${API_KEYS.TRAFIKLAB_API_KEY}&format=json`;

        try {
            const res = await fetchWithCors(url);
            if (!res.ok) {
                console.error("GTFS-RT TripUpdates Fetch Error:", res.status);
                return [];
            }

            const data = await res.json();
            const entities = data.entity || data.entities || [];

            // Filter for stationId
            const stationMatches: any[] = [];

            entities.forEach((entity: any) => {
                const tu = entity.tripUpdate || entity.trip_update;
                if (tu && (tu.stopTimeUpdate || tu.stop_time_update)) {
                    const stops = tu.stopTimeUpdate || tu.stop_time_update;
                    // Match stop_id. Note: Västtrafik GTFS stop_ids are numeric string (e.g. "9021014008000000").
                    // App usually uses these GIDs.
                    const match = stops.find((s: any) => {
                        const id = s.stopId || s.stop_id;
                        return id === stationId;
                    });

                    if (match) {
                        stationMatches.push({
                            trip: tu.trip,
                            update: match
                        });
                    }
                }
            });

            return stationMatches.map((m, idx) => {
                const dep = m.update.departure || m.update.arrival; // Fallback to arrival if terminal
                const depTimeUnix = dep?.time || 0; // Seconds
                const delay = dep?.delay || 0; // Seconds

                const date = new Date(depTimeUnix * 1000);
                // Check if date is valid
                if (isNaN(date.getTime())) return null;

                const iso = date.toISOString();
                const timeStr = date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });

                let status: any = 'ON_TIME';
                if (delay > 60) status = 'LATE';
                if (delay < -60) status = 'EARLY';

                // Check scheduleRelationship
                const rel = m.update.scheduleRelationship || m.update.schedule_relationship;
                if (rel === 'CANCELED' || rel === 'SKIPPED') status = 'CANCELLED';

                return {
                    id: m.trip.tripId || `gtfs-${idx}`,
                    line: m.trip.routeId || "?", // This will be ugly (e.g. 9011...)
                    direction: "Se karta", // Unknown
                    time: timeStr,
                    timestamp: iso,
                    datetime: iso,
                    realtime: delay !== 0 ? timeStr : null,
                    provider: Provider.RESROBOT,
                    type: 'BUS',
                    stopPoint: { name: stationId, gid: stationId },
                    bgColor: '#475569',
                    fgColor: '#ffffff',
                    track: '',
                    status: status,
                    hasDisruption: false
                };
            }).filter(d => d !== null) as Departure[];

        } catch (e) {
            console.error("Trafiklab Realtime Service Error:", e);
            return [];
        }
    }
};
