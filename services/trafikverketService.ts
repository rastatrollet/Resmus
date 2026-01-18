
import { Departure, Provider } from '../types';
import { API_KEYS } from './config';

const TV_AUTH_KEY = API_KEYS.TRAFIKVERKET_API_KEY;


const API_URL = "https://api.trafikinfo.trafikverket.se/v2/data.json";

const getProxyUrl = () => {
    return import.meta.env.DEV ? '/trafikverket-api/v2/data.json' : "https://corsproxy.io/?" + encodeURIComponent(API_URL);
};

export const TrafikverketService = {
    getTrainDepartures: async (stationIdentifier: string, dateTime?: string): Promise<Departure[]> => {
        try {
            // Ensure we have the station cache for mapping signatures to names
            await TrafikverketService.ensureStationCache();

            let locationSign = '';

            // 1. Check if identifier is a valid Signature (Case-insensitive check against cache)
            // stationCache keys are Signatures (e.g. "CST", "M")
            const upperId = stationIdentifier.toUpperCase();
            if (TrafikverketService.stationCache.has(upperId)) {
                locationSign = upperId;
            }
            // 2. Check if identifier is a valid Name (e.g. "Malmö C" -> "M")
            // stationNameMap keys are Names
            else if (TrafikverketService.stationNameMap.has(stationIdentifier)) {
                locationSign = TrafikverketService.stationNameMap.get(stationIdentifier) || '';
            }
            // 3. Fuzzy search in Name Map
            else {
                // Try finding name case-insensitive
                const lowerId = stationIdentifier.toLowerCase();
                for (const [name, sig] of TrafikverketService.stationNameMap.entries()) {
                    if (name.toLowerCase() === lowerId) {
                        locationSign = sig;
                        break;
                    }
                }
            }

            // 4. Fallback: If still no sign, try the API with "clean name" logic (legacy fallback)
            // Only do this if it implies a name (length > 1)
            if (!locationSign && stationIdentifier.length > 1) {
                const cleanName = stationIdentifier.replace(/ T-bana| Spårv| station| C| Central/gi, "").trim();
                // Heuristic: If it looks like a Short Code (uppercase, 2-5 chars), try it as Signature directly in query?
                // But validation failed above. So it's likely a name not in cache (rare) or a typo.
                // Let's rely on the AdvertisedLocationName query.

                const stationXml = `
<REQUEST>
    <LOGIN authenticationkey="${TV_AUTH_KEY}" />
    <QUERY objecttype="TrainStation" schemaversion="1.4">
        <FILTER>
            <EQ name="AdvertisedLocationName" value="${cleanName}" />
        </FILTER>
        <INCLUDE>LocationSignature</INCLUDE>
    </QUERY>
</REQUEST>`;
                try {
                    const stationRes = await fetch(API_URL, { method: 'POST', body: stationXml, headers: { 'Content-Type': 'text/xml' } });
                    if (stationRes.ok) {
                        const sData = await stationRes.json();
                        locationSign = sData?.RESPONSE?.RESULT?.[0]?.TrainStation?.[0]?.LocationSignature;
                    }
                } catch (e) { /* ignore */ }
            }

            if (!locationSign) return [];

            // Step 2: Fetch Departures
            // Filter: LocationSignature = X, ActivityType = Avgång, Time >= now
            const timeFilter = dateTime ? new Date(dateTime).toISOString() : new Date().toISOString();

            const depXml = `
<REQUEST>
    <LOGIN authenticationkey="${TV_AUTH_KEY}" />
    <QUERY objecttype="TrainAnnouncement" schemaversion="1.6" orderby="AdvertisedTimeAtLocation">
        <FILTER>
            <EQ name="LocationSignature" value="${locationSign}" />
            <EQ name="ActivityType" value="Avgång" />
            <GT name="AdvertisedTimeAtLocation" value="${timeFilter}" />
            <LT name="AdvertisedTimeAtLocation" value="${new Date(new Date(timeFilter).getTime() + 14400000).toISOString()}" /> 
            <EQ name="Advertised" value="true" />
        </FILTER>
        <INCLUDE>AdvertisedTrainIdent</INCLUDE>
        <INCLUDE>AdvertisedTimeAtLocation</INCLUDE>
        <INCLUDE>TimeAtLocation</INCLUDE>
        <INCLUDE>TrackAtLocation</INCLUDE>
        <INCLUDE>ToLocation</INCLUDE>
        <INCLUDE>Canceled</INCLUDE>
        <INCLUDE>Deviation</INCLUDE>
        <INCLUDE>EstimatedTimeAtLocation</INCLUDE>
        <INCLUDE>InformationOwner</INCLUDE> 
        <INCLUDE>ProductInformation</INCLUDE>
    </QUERY>
</REQUEST>`;
            // Increased window to 4 hours

            const proxyUrl = getProxyUrl();

            const depRes = await fetch(proxyUrl, {
                method: 'POST',
                body: depXml,
                headers: { 'Content-Type': 'text/xml' }
            });

            if (!depRes.ok) return [];
            const depData = await depRes.json();
            const trains = depData?.RESPONSE?.RESULT?.[0]?.TrainAnnouncement || [];

            return trains.map((t: any) => {
                // Map ToLocation Signatures to Names
                const direction = t.ToLocation ? t.ToLocation.map((l: any) => {
                    return TrafikverketService.stationCache.get(l) || l;
                }).join(', ') : 'Slutstation';

                // Operator & Product
                // ProductInformation is array of { code, description } e.g. "Snabbtåg"
                const product = t.ProductInformation?.[0]?.Description || "";
                const operator = t.InformationOwner;

                return {
                    id: `tv-${t.AdvertisedTrainIdent}-${t.AdvertisedTimeAtLocation}`,
                    line: t.AdvertisedTrainIdent,
                    direction: direction,
                    time: new Date(t.AdvertisedTimeAtLocation).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }),
                    datetime: t.AdvertisedTimeAtLocation,
                    timestamp: t.AdvertisedTimeAtLocation,
                    realtime: t.EstimatedTimeAtLocation ? new Date(t.EstimatedTimeAtLocation).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }) : null,
                    track: t.TrackAtLocation || '',
                    provider: Provider.TRAFIKVERKET,
                    status: t.Canceled ? 'CANCELLED' : (t.EstimatedTimeAtLocation && t.EstimatedTimeAtLocation !== t.AdvertisedTimeAtLocation ? 'LATE' : 'ON_TIME'),
                    type: 'TRAIN',
                    operator: operator,
                    // Store product type (Snabbtåg, osv) somewhere? Maybe in disruptionMessage for now or new field?
                    // Let's prepend to disruptionMessage if it's interesting? No.
                    // Let's try to map it to 'line' if we want "SJ 123"?
                    // User wanted "Perfekt". Displaying "SJ Snabbtåg" is nice. 
                    // Let's assume frontend uses 'operator' field logic.
                    hasDisruption: !!t.Deviation,
                    disruptionMessage: t.Deviation ? t.Deviation.join('. ') : undefined
                };
            });

        } catch (e) {
            console.error("Trafikverket error:", e);
            return [];
        }
    },

    stationCache: new Map<string, string>(),
    stationNameMap: new Map<string, string>(), // Name -> Sig
    stationCoordsMap: new Map<string, { lat: number, lng: number }>(),

    getDisruptions: async (): Promise<any[]> => {
        // Fetch TrainMessages (General traffic info)
        // And maybe major deviations?
        // TrainMessage is good for "Operative events".
        // Filter: Active messages.
        const xml = `
<REQUEST>
    <LOGIN authenticationkey="${TV_AUTH_KEY}" />
    <QUERY objecttype="TrainMessage" schemaversion="1.7">
        <FILTER>
            <EQ name="Active" value="true" />
        </FILTER>
        <INCLUDE>ExternalDescription</INCLUDE>
        <INCLUDE>ReasonCodeText</INCLUDE> 
        <INCLUDE>TrafficImpact</INCLUDE>
        <INCLUDE>StartDateTime</INCLUDE>
        <INCLUDE>EndDateTime</INCLUDE>
        <INCLUDE>ModificationTime</INCLUDE>
        <INCLUDE>EventId</INCLUDE>
        <INCLUDE>County</INCLUDE>
    </QUERY>
</REQUEST>`;

        try {
            const res = await fetch(API_URL, { method: 'POST', body: xml, headers: { 'Content-Type': 'text/xml' } });
            if (!res.ok) return [];
            const data = await res.json();
            const messages = data?.RESPONSE?.RESULT?.[0]?.TrainMessage || [];

            return messages.map((m: any) => {
                let severity: 'severe' | 'normal' | 'slight' | 'unknown' = 'normal';

                // Heuristic for severity based on description or title
                const text = (m.ExternalDescription + " " + m.ReasonCodeText + " " + (m.TrafficImpact || "")).toLowerCase();

                if (text.includes('olycka') || text.includes('urspårning') || text.includes('brand') || text.includes('stopp') || text.includes('inställt')) {
                    severity = 'severe';
                } else if (text.includes('försening') || text.includes('signalfel') || text.includes('växelfel') || text.includes('banfel')) {
                    severity = 'normal';
                } else if (text.includes('mindre') || text.includes('flyttad')) {
                    severity = 'slight';
                }

                return {
                    id: m.EventId,
                    title: m.ReasonCodeText || m.TrafficImpact || "Trafikstörning",
                    description: m.ExternalDescription,
                    severity: severity,
                    startTime: m.StartDateTime,
                    endTime: m.EndDateTime,
                    updatedTime: m.ModificationTime,
                    type: 'TRAIN',
                    affected: m.County ? [{ designation: m.County, color: '#f59e0b' }] : [] // Use County as affected area badge
                };
            });
        } catch (e) {
            console.error("TV Disruptions error", e);
            return [];
        }
    },

    getJourneyDetails: async (journeyRef: string): Promise<any[]> => {
        // Ref expected format: "tv-{TrainIdent}-{DateOrTime}" or just "{TrainIdent}"
        // We need TrainIdent and Date.
        // If Ref comes from our getDepartures, it's "tv-123-2023-01-01T12:00:00".
        // Let's parse it.

        // Ensure cache is loaded for coords
        await TrafikverketService.ensureStationCache();

        let trainIdent = journeyRef;
        let date = new Date().toISOString().split('T')[0];

        if (journeyRef.startsWith('tv-')) {
            const parts = journeyRef.split('-');
            // tv-123-2023-01-01T12:00:00...
            // parts[0] = tv
            // parts[1] = 123
            // parts[2]... could be date parts if ISO string was split?
            // "tv-123-2023-01-01T12:00" -> 123 is index 1.
            trainIdent = parts[1];

            // Extract date from the rest if available, otherwise today
            const potentialDate = parts.slice(2).join('-');
            if (potentialDate && !isNaN(new Date(potentialDate).getTime())) {
                date = potentialDate.split('T')[0];
            }
        }

        // Fetch all announcements for this train on this date
        // Sorted by time to get the route order
        const xml = `
<REQUEST>
    <LOGIN authenticationkey="${TV_AUTH_KEY}" />
    <QUERY objecttype="TrainAnnouncement" schemaversion="1.6" orderby="AdvertisedTimeAtLocation">
        <FILTER>
            <EQ name="AdvertisedTrainIdent" value="${trainIdent}" />
            <GT name="AdvertisedTimeAtLocation" value="${date}T00:00:00" />
            <LT name="AdvertisedTimeAtLocation" value="${date}T23:59:59" /> 
        </FILTER>
        <INCLUDE>LocationSignature</INCLUDE>
        <INCLUDE>AdvertisedLocationName</INCLUDE>
        <INCLUDE>AdvertisedTimeAtLocation</INCLUDE>
        <INCLUDE>EstimatedTimeAtLocation</INCLUDE>
        <INCLUDE>TimeAtLocation</INCLUDE>
        <INCLUDE>TrackAtLocation</INCLUDE>
        <INCLUDE>ActivityType</INCLUDE>
        <INCLUDE>Canceled</INCLUDE>
        <INCLUDE>Deviation</INCLUDE>
    </QUERY>
</REQUEST>`;

        try {
            const proxyUrl = getProxyUrl();
            const res = await fetch(proxyUrl, { method: 'POST', body: xml, headers: { 'Content-Type': 'text/xml' } });
            if (!res.ok) return [];
            const data = await res.json();
            const stops = data?.RESPONSE?.RESULT?.[0]?.TrainAnnouncement || [];

            // Group by Location? 
            // A train usually has Arrival and Departure at the same station (except start/end).
            // JourneyDetail expects a flat list of stops.
            // If a station has both Arr and Dep, we should merge or show Departure time usually?
            // Standard is usually: Show Arrival for end, Departure for start, and usually Departure for intermediate?
            // Or better: Show both if available?
            // Our JourneyDetail interface has `time`.

            // Let's iterate and merge by LocationSignature/Name logic?
            // Actually, showing every event (Arr/Dep) might be verbose.
            // Let's strictly show:
            // - Origin: Dep
            // - Intermediate: Dep (maybe Arr time in tooltip?)
            // - Dest: Arr

            // However, list is ordered by time.
            // We can just filter:
            // "Avgång" typically implies departing. "Ankomst" is arriving.
            // If we just show the events in order, it tells the story.
            // But usually we want 1 row per station.

            const stationMap = new Map<string, any>();

            stops.forEach((s: any) => {
                const sig = s.LocationSignature;
                if (!stationMap.has(sig)) {
                    stationMap.set(sig, {
                        name: s.AdvertisedLocationName,
                        sig: sig,
                        arr: null,
                        dep: null,
                        track: s.TrackAtLocation,
                        cancelled: s.Canceled,
                        deviations: s.Deviation
                    });
                }
                const entry = stationMap.get(sig);
                if (s.ActivityType === 'Ankomst') entry.arr = s;
                if (s.ActivityType === 'Avgång') entry.dep = s;

                // Update track if one event has it and other doesn't? Usually same.
                if (s.TrackAtLocation) entry.track = s.TrackAtLocation;
            });

            // Convert back to array (sorted by time of first event found for that station in the list?)
            // The `stops` array is sorted by time. We can just iterate `stops` and pick unique stations in order.

            const result: any[] = [];
            const processedSigs = new Set<string>();

            stops.forEach((s: any) => {
                const sig = s.LocationSignature;
                if (processedSigs.has(sig)) return;
                processedSigs.add(sig);

                const entry = stationMap.get(sig);

                // Determine main time to show
                // If only Arr -> Arr time (End station)
                // If only Dep -> Dep time (Start station)
                // If both -> Dep time (Intermediate)
                const mainEvent = entry.dep || entry.arr;
                if (!mainEvent) return;

                const planned = mainEvent.AdvertisedTimeAtLocation;
                const estimated = mainEvent.EstimatedTimeAtLocation;
                const isCancelled = entry.cancelled;

                const timeStr = estimated ? new Date(estimated).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }) :
                    new Date(planned).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });

                const originalTimeStr = new Date(planned).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });

                // Check if late
                const isLate = estimated && estimated !== planned;

                const coords = TrafikverketService.stationCoordsMap.get(sig);

                result.push({
                    name: entry.name,
                    time: timeStr, // Realtime if avail
                    track: entry.track || '',
                    date: planned,
                    isCancelled: isCancelled,
                    isDeparture: true, // We treat list items as stop points
                    // Add extra info if needed?
                    notes: entry.deviations,
                    coords: coords
                });
            });

            return result;

        } catch (e) {
            console.error("TV Journey Details Error", e);
            return [];
        }

    },

    ensureStationCache: async () => {
        if (TrafikverketService.stationCache.size > 0 && TrafikverketService.stationCoordsMap.size > 0) return;

        // Fetch all stations (Geometry not needed here, lightweight)
        const xml = `
<REQUEST>
    <LOGIN authenticationkey="${TV_AUTH_KEY}" />
    <QUERY objecttype="TrainStation" schemaversion="1.4">
        <INCLUDE>LocationSignature</INCLUDE>
        <INCLUDE>AdvertisedLocationName</INCLUDE>
        <INCLUDE>Geometry.WGS84</INCLUDE>
    </QUERY>
</REQUEST>`;
        try {
            // We can check if we have it in localStorage?
            const cached = localStorage.getItem('tv_station_cache_v2');
            if (cached) {
                const parsed = JSON.parse(cached);
                if (Date.now() - parsed.timestamp < 86400000) { // 24h cache
                    parsed.data.forEach((s: any) => {
                        TrafikverketService.stationCache.set(s.sig, s.name);
                        TrafikverketService.stationNameMap.set(s.name, s.sig);
                        if (s.lat && s.lng) {
                            TrafikverketService.stationCoordsMap.set(s.sig, { lat: s.lat, lng: s.lng });
                        }
                    });
                    return;
                }
            }

            const proxyUrl = getProxyUrl();
            const res = await fetch(proxyUrl, { method: 'POST', body: xml, headers: { 'Content-Type': 'text/xml' } });
            if (!res.ok) return;
            const data = await res.json();
            const stations = data?.RESPONSE?.RESULT?.[0]?.TrainStation || [];

            const cacheData: any[] = [];
            stations.forEach((s: any) => {
                TrafikverketService.stationCache.set(s.LocationSignature, s.AdvertisedLocationName);
                TrafikverketService.stationNameMap.set(s.AdvertisedLocationName, s.LocationSignature);

                let lat = 0, lng = 0;
                if (s.Geometry?.WGS84) {
                    const match = s.Geometry.WGS84.match(/POINT \(([\d\.]+) ([\d\.]+)\)/);
                    if (match) {
                        lng = parseFloat(match[1]);
                        lat = parseFloat(match[2]);
                    }
                }

                if (lat && lng) {
                    TrafikverketService.stationCoordsMap.set(s.LocationSignature, { lat, lng });
                    cacheData.push({ sig: s.LocationSignature, name: s.AdvertisedLocationName, lat, lng });
                } else {
                    cacheData.push({ sig: s.LocationSignature, name: s.AdvertisedLocationName });
                }
            });

            localStorage.setItem('tv_station_cache_v2', JSON.stringify({ timestamp: Date.now(), data: cacheData }));
        } catch (e) { console.error("Cache init error", e); }
    },

    searchStations: async (query: string): Promise<any[]> => {
        // Ensure cache is loaded
        await TrafikverketService.ensureStationCache();

        if (!query || query.length < 2) return [];
        const lowerQ = query.toLowerCase();

        const results: any[] = [];
        let count = 0;

        // Iterate over cached names
        // Note: Map iteration order is insertion order.
        for (const [name, sig] of TrafikverketService.stationNameMap.entries()) {
            if (name.toLowerCase().includes(lowerQ)) {

                // Prioritize exact start matches
                const isStartMatch = name.toLowerCase().startsWith(lowerQ);

                const coords = TrafikverketService.stationCoordsMap.get(sig);
                const station = {
                    id: `tv-${sig}`,
                    name: name,
                    provider: Provider.TRAFIKVERKET,
                    coords: coords || { lat: 0, lng: 0 },
                    isStartMatch // Helper for sorting
                };

                results.push(station);

                // Soft limit for performance, but we sort later so maybe collect more?
                // Let's collect up to 50
                count++;
                if (count >= 50) break;
            }
        }

        // Sort: StartsWith query first, then alphabetical
        return results.sort((a, b) => {
            if (a.isStartMatch && !b.isStartMatch) return -1;
            if (!a.isStartMatch && b.isStartMatch) return 1;
            return a.name.localeCompare(b.name);
        }).slice(0, 20); // Return top 20
    }
};
