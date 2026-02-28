/**
 * GtfsShapeService
 * ─────────────────────────────────────────────────────────────────────────────
 * Resolves a GTFS-RT vehicle's trip_id / route_id into:
 *   • route metadata  (short name, long name, color, type)
 *   • shape polyline  ([[lat, lon], ...]) from shapes.txt
 *
 * Data source: Trafiklab GTFS Regional Static
 *   https://opendata.samtrafiken.se/gtfs/{operator}/{operator}.zip
 *
 * The zip is large (~20-50 MB) so we:
 *   1. Fetch only once per operator per session (module-level cache).
 *   2. Parse only the three files we need: trips.txt, routes.txt, shapes.txt
 *   3. Cache resolved shapes by shape_id so repeated clicks are instant.
 *
 * NOTE: We use the JSZip library (already a common dep) to unzip in-browser.
 *       If JSZip is not installed, run: npm install jszip
 */

import { API_KEYS } from './config';

// ── Types ────────────────────────────────────────────────────────────────────

export interface RouteInfo {
    routeId: string;
    shortName: string;
    longName: string;
    color: string;       // hex, e.g. "#0ea5e9"
    textColor: string;   // hex, e.g. "#ffffff"
    routeType: number;   // 0=tram,1=metro,2=rail,3=bus,4=ferry
}

export interface ShapePolyline {
    shapeId: string;
    coordinates: [number, number][]; // [lat, lon] pairs
}

export interface JourneyStop {
    id: string;
    name: string;
    lat: number;
    lng: number;
    arrivalTime?: string;
    platformCode?: string;
    seq?: number;
}

export interface VehicleRoutePayload {
    routeInfo: RouteInfo | null;
    shape: ShapePolyline | null;
    tripHeadsign: string | null;
    directionId: number | null;
    resolutionNotes: string[];
    nextStopName: string | null; // Resolved from stops.txt
    nextStopPlatform?: string | null; // Platform code for next stop
    destination: string | null; // Resolved final destination
    line: string | null; // Resolved route_short_name
    journeyStops?: JourneyStop[];
}

// ── Module-level caches ───────────────────────────────────────────────────────

// Parsed static GTFS tables per operator
interface GtfsTables {
    trips: Map<string, { routeId: string; shapeId: string; headsign: string; directionId: number }>;
    routes: Map<string, RouteInfo>;
    shapes: Map<string, [number, number][]>; // shapeId → sorted coords
    stops: Map<string, { name: string, lat: number, lng: number, platformCode?: string }>; // stopId → stop data
    tripStops: Map<string, { stopId: string, seq: number, arrivalTime: string }[]>;
}

const gtfsCache = new Map<string, GtfsTables>();          // operator → tables
const gtfsLoadingPromise = new Map<string, Promise<void>>(); // prevent parallel fetches
const shapeCache = new Map<string, ShapePolyline>();       // shapeId → resolved polyline

// ── CSV Parser (minimal, handles quoted fields) ───────────────────────────────

function parseCsv(text: string): Record<string, string>[] {
    const lines = text.split(/\r?\n/);
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const rows: Record<string, string>[] = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        // Simple split – handles most GTFS files (no embedded newlines in fields)
        const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => { row[h] = vals[idx] ?? ''; });
        rows.push(row);
    }
    return rows;
}

// ── Zip fetcher ───────────────────────────────────────────────────────────────

async function fetchAndParseGtfs(operatorId: string): Promise<void> {
    if (gtfsCache.has(operatorId)) return;

    const key = API_KEYS.TRAFIKLAB_STATIC_KEY;
    if (!key) {
        console.warn('[GtfsShape] Missing TRAFIKLAB_STATIC_KEY');
        return;
    }

    // Let operator mapping handle itself (just use operatorId)
    const requestOpId = operatorId;

    // Trafiklab GTFS Regional Static endpoint
    const zipUrl = `https://opendata.samtrafiken.se/gtfs/${requestOpId}/${requestOpId}.zip?key=${key}`;

    // In DEV use the Vite proxy to avoid CORS; in PROD use corsproxy.io
    const proxyUrl = import.meta.env.DEV
        ? `/trafiklab-static-proxy/${requestOpId}/${requestOpId}.zip?key=${key}`
        : `https://corsproxy.io/?${encodeURIComponent(zipUrl)}`;

    console.log(`[GtfsShape] Fetching static GTFS for operator "${operatorId}" (request mapping: ${requestOpId})…`);

    try {
        const res = await fetch(proxyUrl);
        if (!res.ok) {
            console.error(`[GtfsShape] Fetch failed: ${res.status} ${res.statusText}`);
            return;
        }

        const buffer = await res.arrayBuffer();
        console.log(`[GtfsShape] Downloaded ${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB`);

        // Dynamic import of JSZip (avoids bundling it unless this service is used)
        const JSZip = (await import('jszip')).default;
        const zip = await JSZip.loadAsync(buffer);

        // ── Parse trips.txt ──────────────────────────────────────────────────
        const tripsFile = zip.file('trips.txt');
        const tripsMap = new Map<string, { routeId: string; shapeId: string; headsign: string; directionId: number }>();
        if (tripsFile) {
            const text = await tripsFile.async('text');
            parseCsv(text).forEach(row => {
                tripsMap.set(row.trip_id, {
                    routeId: row.route_id,
                    shapeId: row.shape_id,
                    headsign: row.trip_headsign || '',
                    directionId: parseInt(row.direction_id ?? '0', 10) || 0,
                });
            });
            console.log(`[GtfsShape] Parsed ${tripsMap.size} trips`);
        }

        // ── Parse routes.txt ─────────────────────────────────────────────────
        const routesFile = zip.file('routes.txt');
        const routesMap = new Map<string, RouteInfo>();
        if (routesFile) {
            const text = await routesFile.async('text');
            parseCsv(text).forEach(row => {
                const shortName = row.route_short_name || '?';
                let color = row.route_color ? `#${row.route_color.replace('#', '')}` : '#0ea5e9';
                let textColor = row.route_text_color ? `#${row.route_text_color.replace('#', '')}` : '#ffffff';

                if (operatorId === 'jlt') {
                    const sn = shortName.trim();
                    const snNum = parseInt(sn, 10);
                    if (sn === '1') { color = '#E61C24'; textColor = '#ffffff'; }
                    else if (sn === '2') { color = '#FBB040'; textColor = '#000000'; }
                    else if (sn === '3') { color = '#00A651'; textColor = '#ffffff'; }
                    else if (sn === '4') { color = '#00AEEF'; textColor = '#ffffff'; }
                    else if (!isNaN(snNum) && snNum >= 11 && snNum <= 37) { color = '#662D91'; textColor = '#ffffff'; }
                    else { color = '#0ea5e9'; textColor = '#ffffff'; }
                }

                if (operatorId === 'skane') {
                    // Force text color based on brightness or simple rules
                    // Usually Skånetrafiken STAD (green) text is white, REGION (yellow) is black, PAgatåg (purple) white.
                    if (row.route_type === '2' || row.route_type === '109') {
                        // Train (Pågatågen / Öresundståg)
                        color = row.route_color ? `#${row.route_color.replace('#', '')}` : '#7e3089';
                        textColor = '#ffffff';
                    } else if (row.route_type === '0') {
                        // Tram in Lund
                        color = row.route_color ? `#${row.route_color.replace('#', '')}` : '#80b331';
                        textColor = '#ffffff';
                    } else {
                        // Bus
                        // Identify Region vs Stad based on route_short_name or route_color
                        // If color is missing, apply rules based on line length
                        const snNum = parseInt(shortName.trim());
                        if (!row.route_color) {
                            if (!isNaN(snNum) && snNum >= 100) {
                                color = '#f6c321'; // Regionbuss gul
                                textColor = '#000000';
                            } else {
                                color = '#80b331'; // Stadsbuss grön
                                textColor = '#ffffff';
                            }
                        } else {
                            color = `#${row.route_color.replace('#', '')}`;
                            // If it's a yellow hex, use black text
                            if (color.toLowerCase() === '#f6c321' || color.toLowerCase() === '#fde100' || color.toLowerCase() === '#f8d000' || color.toLowerCase() === '#fac800' || color.toLowerCase() === '#f1c40f') {
                                textColor = '#000000';
                            } else {
                                textColor = '#ffffff';
                            }
                        }
                    }
                }

                routesMap.set(row.route_id, {
                    routeId: row.route_id,
                    shortName: shortName,
                    longName: row.route_long_name || '',
                    color,
                    textColor,
                    routeType: parseInt(row.route_type ?? '3', 10),
                });
            });
            console.log(`[GtfsShape] Parsed ${routesMap.size} routes`);
        }



        // ── Parse stops.txt ────────────────────────────────────────────────
        const stopsFile = zip.file('stops.txt');
        const stopsMap = new Map<string, { name: string, lat: number, lng: number, platformCode?: string }>();
        if (stopsFile) {
            const text = await stopsFile.async('text');
            parseCsv(text).forEach(row => {
                if (row.stop_id && row.stop_name && row.stop_lat && row.stop_lon) {
                    stopsMap.set(row.stop_id, {
                        name: row.stop_name,
                        lat: parseFloat(row.stop_lat),
                        lng: parseFloat(row.stop_lon),
                        platformCode: row.platform_code || ''
                    });
                }
            });
            console.log(`[GtfsShape] Parsed ${stopsMap.size} stops`);
        }

        // ── Parse stop_times.txt ──────────────────────────────────────────
        const stopTimesFile = zip.file('stop_times.txt');
        const tripStopsMap = new Map<string, { stopId: string, seq: number, arrivalTime: string }[]>();
        if (stopTimesFile) {
            const text = await stopTimesFile.async('text');
            const lines = text.split(/\r?\n/);
            const headersRow = lines[0] || '';
            const headers = headersRow.split(',').map(h => h.trim().replace(/^"|"$/g, ''));
            const tIdx = headers.indexOf('trip_id');
            const aIdx = headers.indexOf('arrival_time');
            const sIdx = headers.indexOf('stop_id');
            const sqIdx = headers.indexOf('stop_sequence');

            for (let i = 1; i < lines.length; i++) {
                const line = lines[i];
                if (!line) continue;
                // Optimized parse for stop_times which does not have commas in its values
                const parts = line.split(',');
                const tripId = parts[tIdx]?.replace(/^"|"$/g, '');
                if (!tripId) continue;

                let arr = tripStopsMap.get(tripId);
                if (!arr) {
                    arr = [];
                    tripStopsMap.set(tripId, arr);
                }
                arr.push({
                    stopId: parts[sIdx]?.replace(/^"|"$/g, '') || '',
                    seq: parseInt(parts[sqIdx] || '0', 10),
                    arrivalTime: parts[aIdx]?.replace(/^"|"$/g, '') || ''
                });
            }

            for (const stops of tripStopsMap.values()) {
                stops.sort((a, b) => a.seq - b.seq);
            }
            console.log(`[GtfsShape] Parsed stop_times for ${tripStopsMap.size} trips`);
        }

        // ── Update Cache with Routes/Trips/Stops first (Fast) ──────────────
        const tables = { trips: tripsMap, routes: routesMap, shapes: new Map() as Map<string, [number, number][]>, stops: stopsMap, tripStops: tripStopsMap };
        gtfsCache.set(operatorId, tables);

        // ── Parse shapes.txt (Slow/Heavy) - Deferred ───────────────────────
        // We do this immediately but if it takes time, at least routes are avail.
        // The current architecture requires atomic tables.
        // Let's stick to parsing it here but optimize if needed.

        const shapesFile = zip.file('shapes.txt');
        if (shapesFile) {
            const text = await shapesFile.async('text');
            const shapesRaw = new Map<string, { lat: number; lng: number; seq: number }[]>();

            parseCsv(text).forEach(row => {
                if (!row.shape_id || !row.shape_pt_lat || !row.shape_pt_lon || !row.shape_pt_sequence) return;
                if (!shapesRaw.has(row.shape_id)) shapesRaw.set(row.shape_id, []);
                shapesRaw.get(row.shape_id)!.push({
                    lat: parseFloat(row.shape_pt_lat),
                    lng: parseFloat(row.shape_pt_lon),
                    seq: parseInt(row.shape_pt_sequence, 10)
                });
            });

            const sortedShapes = new Map<string, [number, number][]>();
            for (const [id, points] of shapesRaw.entries()) {
                points.sort((a, b) => a.seq - b.seq);
                sortedShapes.set(id, points.map(p => [p.lat, p.lng]));
            }
            console.log(`[GtfsShape] Parsed ${sortedShapes.size} shapes`);

            // Update shapes in cache
            tables.shapes = sortedShapes;
        }
    } catch (e) {
        console.error('[GtfsShape] Error loading static GTFS:', e);
    }
}

// ── Public API ────────────────────────────────────────────────────────────────

export const GtfsShapeService = {

    /**
     * Pre-load static GTFS for an operator (call on map load or operator change).
     * Safe to call multiple times – only fetches once per session.
     */
    preload: async (operatorId: string): Promise<void> => {
        if (gtfsCache.has(operatorId)) return;
        if (!gtfsLoadingPromise.has(operatorId)) {
            gtfsLoadingPromise.set(operatorId, fetchAndParseGtfs(operatorId));
        }
        return gtfsLoadingPromise.get(operatorId);
    },

    /**
     * Resolve a vehicle's trip_id (and/or route_id) into route metadata + shape.
     *
     * @param tripId   - from GTFS-RT vehicle.trip.trip_id
     * @param routeId  - from GTFS-RT vehicle.trip.route_id (fallback if no tripId)
     * @param operatorId - e.g. 'vasttrafik', 'sl', 'skane'
     */
    resolve: async (
        tripId: string | null | undefined,
        routeId: string | null | undefined,
        operatorId: string,
        stopId?: string | null,
        realtimeHeadsign?: string | null,
        stopSequence?: number | null,
        vehicleLat?: number | null,
        vehicleLng?: number | null
    ): Promise<VehicleRoutePayload> => {
        const notes: string[] = [];

        // Ensure GTFS is loaded
        await GtfsShapeService.preload(operatorId);

        const tables = gtfsCache.get(operatorId);
        if (!tables) {
            return {
                routeInfo: null,
                shape: null,
                tripHeadsign: null,
                directionId: null,
                resolutionNotes: ['GTFS tables not loaded'],
                nextStopName: null,
                nextStopPlatform: null,
                destination: null,
                line: null
            };
        }

        // ── 1. Line Resolution ───────────────────────────────────────────────
        let resolvedLine: string | null = null;
        let finalRouteId: string | null = null;
        let shapeId: string | null = null;
        let headsign: string | null = null;
        let directionId: number | null = null;

        // Priority 1: Trip ID -> Route ID
        if (tripId) {
            const trip = tables.trips.get(tripId);
            if (trip) {
                finalRouteId = trip.routeId;
                shapeId = trip.shapeId || null;
                headsign = trip.headsign || null;
                directionId = trip.directionId;
            } else {
                notes.push(`trip_id "${tripId}" not found in trips.txt`);
            }
        }

        // Priority 2: Provided Route ID (Fallback)
        if (!finalRouteId && routeId) {
            finalRouteId = routeId;
        }

        // Lookup Route Info
        let routeInfo: RouteInfo | null = null;
        if (finalRouteId) {
            routeInfo = tables.routes.get(finalRouteId) ?? null;
            if (routeInfo) {
                resolvedLine = routeInfo.shortName;
            } else {
                notes.push(`route_id "${finalRouteId}" not found in routes.txt`);
            }
        } else {
            notes.push('No route_id resolved');
        }

        // ── Step 2.5: Build Journey Stops & Find Last Stop ───────────────────
        let journeyStops: JourneyStop[] | undefined;
        let lastStopFallbackName: string | null = null;

        if (tripId) {
            const tstops = tables.tripStops.get(tripId);
            if (tstops && tstops.length > 0) {
                journeyStops = tstops.map(t => {
                    const stopObj = tables.stops.get(t.stopId);
                    return stopObj ? {
                        id: t.stopId,
                        name: stopObj.name,
                        seq: t.seq,
                        arrivalTime: t.arrivalTime,
                        platformCode: stopObj.platformCode,
                        lat: stopObj.lat,
                        lng: stopObj.lng
                    } : null;
                }).filter(s => s !== null) as JourneyStop[];

                // sort by sequence (already sorted when parsing stop_times, but good to be explicit)
                journeyStops.sort((a, b) => (a.seq || 0) - (b.seq || 0));

                if (journeyStops.length > 0) {
                    lastStopFallbackName = journeyStops[journeyStops.length - 1].name;
                }
            }
        }

        // ── Destination Resolver (Priority: Realtime > Static > RouteName) ──
        let resolvedDestination: string | null = null;

        // 1. Realtime Trip Headsign (if provided)
        if (realtimeHeadsign) {
            resolvedDestination = realtimeHeadsign;
        }

        // 2. Static Trip Headsign
        if (!resolvedDestination && headsign) {
            resolvedDestination = headsign;
        }

        // 3. Last Stop Name
        if (!resolvedDestination && lastStopFallbackName) {
            resolvedDestination = lastStopFallbackName;
        }

        // 4. Route Long Name (Fallback)
        if (!resolvedDestination && routeInfo?.longName) {
            resolvedDestination = routeInfo.longName;
        }

        // 5. Route Short Name
        if (!resolvedDestination && routeInfo?.shortName) {
            resolvedDestination = routeInfo.shortName;
        }

        // ── Step 3: Resolve shape ─────────────────────────────────────────────
        let shape: ShapePolyline | null = null;
        if (shapeId) {
            // Check module-level shape cache first
            if (shapeCache.has(shapeId)) {
                shape = shapeCache.get(shapeId)!;
            } else {
                const coords = tables.shapes.get(shapeId);
                if (coords && coords.length >= 2) {
                    shape = { shapeId, coordinates: coords };
                    shapeCache.set(shapeId, shape);
                } else {
                    notes.push(`shape_id "${shapeId}" not found or has < 2 points`);
                }
            }
        } else if (tripId) {
            notes.push('No shape_id for this trip');
        }

        let nextStopName: string | null = null;
        let nextStopPlatform: string | null = null;
        if (stopId) {
            const nextStopObj = tables.stops.get(stopId);
            if (nextStopObj) {
                nextStopName = nextStopObj.name;
                nextStopPlatform = nextStopObj.platformCode || null;
            }
        }

        // Extended fallback to check journeyStops if we have stopSequence
        if (!nextStopName && journeyStops && journeyStops.length > 0) {
            if (stopSequence !== undefined && stopSequence !== null) {
                const remainingStops = journeyStops.filter(s => s.seq !== undefined && s.seq >= stopSequence);
                if (remainingStops.length > 0) {
                    nextStopName = remainingStops[0].name;
                    nextStopPlatform = remainingStops[0].platformCode || null;
                }
            }

            // Geographic nearest-stop fallback if sequence failed or missing
            if (!nextStopName && vehicleLat != null && vehicleLng != null) {
                let closestDist = Infinity;
                let closestStop = null;
                for (const s of journeyStops) {
                    const dist = Math.pow(s.lat - vehicleLat, 2) + Math.pow(s.lng - vehicleLng, 2);
                    if (dist < closestDist) {
                        closestDist = dist;
                        closestStop = s;
                    }
                }
                if (closestStop) {
                    nextStopName = closestStop.name;
                    nextStopPlatform = closestStop.platformCode || null;
                }
            }
        }

        if (!nextStopName && stopId) {
            notes.push(`stop_id "${stopId}" not found in stops.txt`);
        }

        return {
            routeInfo,
            shape,
            tripHeadsign: headsign, // Strict static headsign for backward compat if needed
            directionId,
            resolutionNotes: notes,
            nextStopName,
            nextStopPlatform,
            destination: resolvedDestination,
            line: resolvedLine,
            journeyStops
        };
    },

    /**
     * Synchronously resolves a vehicle's route metadata and shape if already loaded in memory.
     * Use this for instant UI updates. Returns null if GTFS is not loaded yet.
     */
    resolveSync: (
        tripId: string | null | undefined,
        routeId: string | null | undefined,
        operatorId: string,
        stopId?: string | null,
        realtimeHeadsign?: string | null,
        stopSequence?: number | null,
        vehicleLat?: number | null,
        vehicleLng?: number | null
    ): VehicleRoutePayload | null => {
        const tables = gtfsCache.get(operatorId);
        if (!tables) return null;

        const notes: string[] = [];
        let resolvedLine: string | null = null;
        let finalRouteId: string | null = null;
        let shapeId: string | null = null;
        let headsign: string | null = null;
        let directionId: number | null = null;

        if (tripId) {
            const trip = tables.trips.get(tripId);
            if (trip) {
                finalRouteId = trip.routeId;
                shapeId = trip.shapeId || null;
                headsign = trip.headsign || null;
                directionId = trip.directionId;
            } else {
                notes.push(`trip_id "${tripId}" not found in trips.txt`);
            }
        }

        if (!finalRouteId && routeId) finalRouteId = routeId;

        let routeInfo: RouteInfo | null = null;
        if (finalRouteId) {
            routeInfo = tables.routes.get(finalRouteId) ?? null;
            if (routeInfo) {
                resolvedLine = routeInfo.shortName;
            } else {
                notes.push(`route_id "${finalRouteId}" not found in routes.txt`);
            }
        }

        let journeyStops: JourneyStop[] | undefined;
        let lastStopFallbackName: string | null = null;

        if (tripId) {
            const tstops = tables.tripStops.get(tripId);
            if (tstops && tstops.length > 0) {
                journeyStops = tstops.map(t => {
                    const stopObj = tables.stops.get(t.stopId);
                    return stopObj ? {
                        id: t.stopId,
                        name: stopObj.name,
                        seq: t.seq,
                        arrivalTime: t.arrivalTime,
                        platformCode: stopObj.platformCode,
                        lat: stopObj.lat,
                        lng: stopObj.lng
                    } : null;
                }).filter(s => s !== null) as JourneyStop[];

                journeyStops.sort((a, b) => (a.seq || 0) - (b.seq || 0));

                if (journeyStops.length > 0) {
                    lastStopFallbackName = journeyStops[journeyStops.length - 1].name;
                }
            }
        }

        let resolvedDestination: string | null = null;
        if (realtimeHeadsign) resolvedDestination = realtimeHeadsign;
        if (!resolvedDestination && headsign) resolvedDestination = headsign;
        if (!resolvedDestination && lastStopFallbackName) resolvedDestination = lastStopFallbackName;
        if (!resolvedDestination && routeInfo?.longName) resolvedDestination = routeInfo.longName;
        if (!resolvedDestination && routeInfo?.shortName) resolvedDestination = routeInfo.shortName;

        let shape: ShapePolyline | null = null;
        if (shapeId) {
            if (shapeCache.has(shapeId)) {
                shape = shapeCache.get(shapeId)!;
            } else {
                const coords = tables.shapes.get(shapeId);
                if (coords && coords.length >= 2) {
                    shape = { shapeId, coordinates: coords };
                    shapeCache.set(shapeId, shape);
                }
            }
        }

        let nextStopName: string | null = null;
        let nextStopPlatform: string | null = null;
        if (stopId) {
            const nextStopObj = tables.stops.get(stopId);
            if (nextStopObj) {
                nextStopName = nextStopObj.name;
                nextStopPlatform = nextStopObj.platformCode || null;
            }
        }

        if (!nextStopName && journeyStops && journeyStops.length > 0) {
            if (stopSequence !== undefined && stopSequence !== null) {
                const remainingStops = journeyStops.filter(s => s.seq !== undefined && s.seq >= stopSequence);
                if (remainingStops.length > 0) {
                    nextStopName = remainingStops[0].name;
                    nextStopPlatform = remainingStops[0].platformCode || null;
                }
            }

            if (!nextStopName && vehicleLat != null && vehicleLng != null) {
                let closestDist = Infinity;
                let closestStop = null;
                for (const s of journeyStops) {
                    const dist = Math.pow(s.lat - vehicleLat, 2) + Math.pow(s.lng - vehicleLng, 2);
                    if (dist < closestDist) {
                        closestDist = dist;
                        closestStop = s;
                    }
                }
                if (closestStop) {
                    nextStopName = closestStop.name;
                    nextStopPlatform = closestStop.platformCode || null;
                }
            }
        }

        return {
            routeInfo,
            shape,
            tripHeadsign: headsign,
            directionId,
            resolutionNotes: notes,
            nextStopName,
            nextStopPlatform,
            destination: resolvedDestination,
            line: resolvedLine,
            journeyStops
        };
    },

    /** Get a map of routeId -> shortName for an operator */
    getRouteMap: (operatorId: string): Map<string, string> | null => {
        const tables = gtfsCache.get(operatorId);
        if (!tables) return null;

        const map = new Map<string, string>();
        for (const [routeId, info] of tables.routes.entries()) {
            map.set(routeId, info.shortName);
        }
        return map;
    },

    /**
     * Synchronously get line info (shortName, headsign, color) from cache.
     * Useful for rendering markers without async overhead.
     */
    getLineInfo: (operatorId: string, tripId?: string, routeId?: string): { line: string, longName?: string, headsign?: string, color: string, textColor: string, routeType?: number } | null => {
        const tables = gtfsCache.get(operatorId);
        if (!tables) return null;

        let rId = routeId;
        let headsign = '';

        // Try trip lookup first
        if (tripId) {
            const t = tables.trips.get(tripId);
            if (t) {
                rId = t.routeId;
                headsign = t.headsign;
            }
        }

        if (rId) {
            const r = tables.routes.get(rId);
            if (r) {
                return {
                    line: r.shortName,
                    longName: r.longName,
                    color: r.color,
                    textColor: r.textColor,
                    headsign: headsign || (r.longName), // Fallback to route name if trip headsign missing
                    routeType: r.routeType
                };
            }
        }
        return null;
    },

    /** True if static GTFS has been loaded for this operator */
    isLoaded: (operatorId: string): boolean => gtfsCache.has(operatorId),

    /** Returns all stops for an operator */
    getAllStops: (operatorId: string, minLat?: number, minLng?: number, maxLat?: number, maxLng?: number): { id: string, name: string, lat: number, lng: number, platformCode?: string }[] => {
        const tables = gtfsCache.get(operatorId);
        if (!tables) return [];

        const stops: { id: string, name: string, lat: number, lng: number, platformCode?: string }[] = [];
        for (const [id, s] of tables.stops.entries()) {
            if (minLat && minLng && maxLat && maxLng) {
                if (s.lat >= minLat && s.lat <= maxLat && s.lng >= minLng && s.lng <= maxLng) {
                    stops.push({ id, name: s.name, lat: s.lat, lng: s.lng, platformCode: s.platformCode });
                }
            } else {
                stops.push({ id, name: s.name, lat: s.lat, lng: s.lng, platformCode: s.platformCode });
            }
        }
        return stops;
    },

    /** How many shapes are cached for an operator */
    stats: (operatorId: string) => {
        const t = gtfsCache.get(operatorId);
        if (!t) return null;
        return { trips: t.trips.size, routes: t.routes.size, shapes: t.shapes.size };
    }
};
