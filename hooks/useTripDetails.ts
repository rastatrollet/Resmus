import { useState, useEffect } from 'react';
import { API_KEYS, API_URLS } from '../services/config';

interface SimplifiedStop {
    name: string;
    arrivalTime: string;
    departureTime: string;
    track: string;
}

export const useTripDetails = (journeyDetailRefUrl: string | null) => {
    const [stops, setStops] = useState<SimplifiedStop[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!journeyDetailRefUrl) {
            setStops([]);
            return;
        }

        const fetchDetails = async () => {
            setLoading(true);
            setError(null);

            // 1. Prepare URL (Inject Key if missing)
            let url = journeyDetailRefUrl;
            const hasKey = url.includes('key=') || url.includes('accessId=');

            if (!hasKey) {
                // ResRobot specific parameter is usually 'accessId' or 'key' depending on version. 
                // V2.1 uses 'accessId'.
                const separator = url.includes('?') ? '&' : '?';
                url = `${url}${separator}accessId=${API_KEYS.RESROBOT_API_KEY}&format=json`;
            }

            // Ensure JSON format requested if not present
            if (!url.includes('format=json')) {
                const separator = url.includes('?') ? '&' : '?';
                url = `${url}${separator}format=json`;
            }

            console.log(`[useTripDetails] Fetching: ${url}`);

            try {
                // Use CORS proxy helper logic or direct fetch if local proxy configured
                // Simplified for this hook:
                let fetchUrl = url;
                // In local development, we might need a proxy if URL is external
                if (import.meta.env.DEV && !url.startsWith('/')) {
                    fetchUrl = "https://corsproxy.io/?" + encodeURIComponent(url);
                }

                const res = await fetch(fetchUrl);
                if (!res.ok) {
                    throw new Error(`Failed to fetch details. Status: ${res.status}`);
                }

                const data = await res.json();

                // 2. Map Response
                // Structure: { JourneyDetail: { Stops: { Stop: [...] } } }
                let rawStops: any[] = [];

                // Handle variations
                const jd = data.JourneyDetail || data.JourneyLocation;
                if (jd && jd.Stops && jd.Stops.Stop) {
                    rawStops = Array.isArray(jd.Stops.Stop) ? jd.Stops.Stop : [jd.Stops.Stop];
                } else if (data.files && data.files.length === 0) {
                    // Sometimes empty response?
                    rawStops = [];
                }

                console.log(`[useTripDetails] Found ${rawStops.length} raw stops`);

                const simplified: SimplifiedStop[] = rawStops.map((s: any) => ({
                    name: s.name,
                    // Handle missing times (start/end stations)
                    arrivalTime: s.arrTime ? s.arrTime.substring(0, 5) : (s.depTime ? s.depTime.substring(0, 5) : '--:--'),
                    departureTime: s.depTime ? s.depTime.substring(0, 5) : (s.arrTime ? s.arrTime.substring(0, 5) : '--:--'),
                    track: s.rtTrack || s.track || ''
                }));

                setStops(simplified);

            } catch (e: any) {
                console.error(`[useTripDetails] Error fetching ${url}:`, e);
                setError(e.message || "Ett fel uppstod");
            } finally {
                setLoading(false);
            }
        };

        fetchDetails();
    }, [journeyDetailRefUrl]);

    return { stops, loading, error };
};
