
import { Departure, Station, Provider } from '../types';

// Cache variables for advanced Client-Side filtering
let cachedSites: any[] | null = null;
let fetchPromise: Promise<void> | null = null;

export const SLService = {
    // Search for stations by name (Site)
    searchStations: async (query: string): Promise<Station[]> => {
        try {
            // 1. Ensure we have the full network loaded (Lazy Load)
            if (!cachedSites) {
                if (!fetchPromise) {
                    console.log("Initializing SL Network Cache (Client-side filtering enabled)...");
                    // Fetch ALL sites (no name param) to allow proper filtering
                    fetchPromise = fetch(`https://transport.integration.sl.se/v1/sites?expand=true`)
                        .then(res => {
                            if (!res.ok) throw new Error(`SL API Error: ${res.status}`);
                            return res.json();
                        })
                        .then(data => {
                            console.log(`SL Network Loaded: ${data.length} sites`);
                            cachedSites = data;
                        })
                        .catch(e => {
                            console.error("Failed to load SL Network", e);
                            cachedSites = [];
                        })
                        .finally(() => {
                            fetchPromise = null;
                        });
                }
                await fetchPromise;
            }

            if (!cachedSites) return [];

            // 2. Client-Side Filtering (Fuzzy-ish)
            const normalize = (str: string) => str.toLowerCase().replace(/[\s-]/g, '');
            const qClean = normalize(query);

            const matches = cachedSites.filter((s: any) => {
                if (!s.name) return false;
                const nameClean = normalize(s.name);
                return nameClean.includes(qClean);
            });

            // 3. Smart Sorting (The "Secret Sauce")
            const sorted = matches.sort((a: any, b: any) => {
                const getScore = (site: any) => {
                    let score = 0;

                    // Check validTransportModes from expand=true
                    const modes = (site.validTransportModes || []).map((m: string) => m.toUpperCase());

                    if (modes.includes('METRO') || modes.includes('TRAIN')) score = 30;
                    else if (modes.includes('TRAM') || modes.includes('BUS')) score = 20;
                    else if (modes.includes('SHIP') || modes.includes('FERRY')) score = 10;

                    const n = site.name.toLowerCase();
                    if (n.includes('t-centralen') || n.includes('station')) score += 5;
                    if (n.match(/(brygga|hamn|färjeläge)$/)) score -= 15; // Penalty for ferries

                    // Boost exact starts for better UX
                    // Use normalized comparison for robustness
                    if (normalize(n).startsWith(qClean)) score += 2;

                    return score;
                };

                return getScore(b) - getScore(a);
            });

            return sorted.map((site: any) => ({
                id: String(site.id),
                name: site.name,
                provider: Provider.SL,
                coords: { lat: 0, lng: 0 }
            })).slice(0, 20);

        } catch (e) {
            console.error("SL Search Error:", e);
            return [];
        }
    },

    // Get departures for a site
    getDepartures: async (siteId: string, timeWindowMinutes: number = 60): Promise<Departure[]> => {
        // 1. Log ID immediately
        console.log(`SL Service called with SiteID: "${siteId}"`);

        if (!siteId) {
            console.warn("SL Service: No SiteID provided, aborting.");
            return [];
        }

        try {
            // Safety: Handle possible external/legacy IDs (e.g. 300109001 -> 9001)
            let cleanId = String(siteId);
            if (cleanId.length > 5 && cleanId.startsWith('30010')) {
                cleanId = cleanId.substring(5);
            }

            // Construct URL using API compatible format
            const baseUrl = `https://transport.integration.sl.se/v1/sites/${cleanId}/departures`;
            const url = new URL(baseUrl);

            // Forecast: Ensure at least 60 minutes window to find infrequent buses
            const effectiveWindow = Math.max(timeWindowMinutes, 60);
            url.searchParams.append('forecast', String(effectiveWindow));

            // Transport: OMIT parameter to fetch ALL modes.
            // Sending comma-separated values (e.g. "BUS,METRO") causes 400 Bad Request.
            // To filter, we would need multiple 'transport' params, but omitting gets everything which is safer.

            console.log(`SL Debug URL: ${url.toString()}`);

            const res = await fetch(url.toString());
            if (!res.ok) {
                const txt = await res.text();
                console.error(`SL API Fail: ${res.status} - ${txt}`);
                throw new Error(`SL API Error: ${res.status} ${txt}`);
            }

            const data = await res.json();
            const rawCount = data.departures ? data.departures.length : 0;
            console.log(`SL Raw Response: ${rawCount} departures found.`);

            if (!data.departures) return [];

            return data.departures.map((d: any) => {
                const line = d.line;
                const transportMode = line.transport_mode;

                // Determine type
                let type: 'BUS' | 'TRAM' | 'TRAIN' | 'METRO' | 'FERRY' | 'UNK' = 'BUS';
                if (transportMode === 'METRO') type = 'METRO';
                else if (transportMode === 'TRAM') type = 'TRAM';
                else if (transportMode === 'TRAIN') type = 'TRAIN';
                else if (transportMode === 'SHIP') type = 'FERRY';

                // Colors for Metro
                let bgColor = undefined;
                let fgColor = undefined;

                if (type === 'METRO' && line.group_of_lines) {
                    const group = line.group_of_lines.toLowerCase();
                    if (group.includes('grön')) {
                        bgColor = '#17c15c'; // Green Line
                        fgColor = '#ffffff';
                    } else if (group.includes('röd')) {
                        bgColor = '#d91f26'; // Red Line
                        fgColor = '#ffffff';
                    } else if (group.includes('blå')) {
                        bgColor = '#0078bf'; // Blue Line
                        fgColor = '#ffffff';
                    }
                }

                // Pendeltåg Pink/Blue or default
                if (type === 'TRAIN') {
                    // SL Pendeltåg usually standard color or line specific
                }

                // TRAM - Lidingöbanan etc have specific colors but default TRAM handling in UI is okay usually.

                // Time parsing
                // scheduled: "2023-10-XXT..."
                // expected: "2023-10-XXT..."

                const scheduled = d.scheduled;
                const expected = d.expected || scheduled;

                // Robust time extractor (HH:MM)
                const getTime = (iso: string) => {
                    if (!iso) return '';
                    try {
                        // Create date and force Swedish locale time
                        const date = new Date(iso);
                        return date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
                    } catch {
                        // Fallback: simple string slice if Date fails (e.g. T20:11:00)
                        const match = iso.match(/T(\d{2}:\d{2})/);
                        return match ? match[1] : '';
                    }
                };

                const time = getTime(scheduled);
                const realtime = getTime(expected);

                let status: 'ON_TIME' | 'LATE' | 'CANCELLED' | 'EARLY' = 'ON_TIME';
                if (d.state === 'CANCELLED') status = 'CANCELLED';
                else if (expected && scheduled && expected !== scheduled) status = 'LATE'; // Simplified

                return {
                    id: `sl-${siteId}-${line.designation}-${d.scheduled}-${Math.random()}`, // SL API doesn't guarantee unique ID per departure instance easily?
                    journeyRef: d.journey?.id ? `sl-${d.journey.id}` : undefined,
                    line: line.designation,
                    direction: d.destination,
                    time,
                    timestamp: expected || scheduled,
                    realtime: status === 'CANCELLED' ? undefined : realtime,
                    track: d.stop_point?.designation || '',
                    provider: Provider.SL,
                    status,
                    type,
                    bgColor,
                    fgColor,
                    stopPoint: {
                        name: d.stop_point?.name || '',
                        gid: d.stop_point?.id || ''
                    },
                    hasDisruption: d.deviations && d.deviations.length > 0,
                    disruptionMessage: d.deviations?.[0]?.message || undefined,
                    datetime: expected || scheduled
                };
            });

        } catch (e) {
            console.error("SL Departures Error:", e);
            return [];
        }
    },

    getJourneyDetails: async (journeyRef: string): Promise<any[]> => {
        const id = journeyRef.replace('sl-', '');
        const url = `https://transport.integration.sl.se/v1/journeys/${id}`;
        try {
            const res = await fetch(url);
            if (!res.ok) return [];
            const data = await res.json();

            if (!data.stop_points) return [];

            return data.stop_points.map((sp: any) => {
                const format = (iso: string) => iso ? new Date(iso).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }) : undefined;
                const pArr = sp.arrival?.scheduled;
                const pDep = sp.departure?.scheduled;
                const rArr = sp.arrival?.expected;
                const rDep = sp.departure?.expected;

                const finalTime = rDep || pDep || rArr || pArr;

                return {
                    name: sp.stop_area?.name || sp.name || "Station",
                    time: format(finalTime) || '--:--',
                    track: sp.stop_point?.designation || "",
                    date: finalTime,
                    isCancelled: sp.state === 'CANCELLED',
                    isDeparture: !!pDep,
                    coords: undefined,
                    arrivalTime: format(pArr),
                    departureTime: format(pDep),
                    realtimeArrival: format(rArr),
                    realtimeDeparture: format(rDep)
                };
            });
        } catch (e) {
            console.error("SL Journey Details Error", e);
            return [];
        }
    },

    // Get all global traffic deviations
    getDeviations: async (): Promise<any[]> => {
        try {
            // Fetch deviations for all modes
            // Using generic endpoint to get network-wide issues
            // NOTE: Sending transport_mode parameters (e.g. ?transport_mode=BUS...) causes 400 Bad Request on this endpoint.
            // We fetch all and filter client-side if needed.
            const url = `https://deviations.integration.sl.se/v1/messages`;
            console.log(`SL Deviations Fetch: ${url}`);

            const res = await fetch(url);
            if (!res.ok) throw new Error(`SL Deviations Failed: ${res.status}`);

            const data = await res.json();
            // SL Deviations API returns a top-level array
            return Array.isArray(data) ? data : [];
        } catch (e) {
            console.error("SL Deviations Error:", e);
            return [];
        }
    },
};

// Optimize: Auto-prefetch SL network data shortly after load
// This ensures that when the user types, the 5MB+ dataset is likely already cached.
setTimeout(() => {
    SLService.searchStations('');
}, 3000);
