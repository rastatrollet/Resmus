/**
 * StopNameResolver — Resolves GTFS stop IDs to human-readable stop names
 * ─────────────────────────────────────────────────────────────────────────
 * Uses ResRobot location lookup API with aggressive caching.
 * Cached in localStorage to avoid repeated API calls across sessions.
 */

import { API_KEYS } from './config';

const CACHE_KEY = 'stop_name_cache';
const cache = new Map<string, string>();

// Load from localStorage on init
try {
    const stored = localStorage.getItem(CACHE_KEY);
    if (stored) {
        const entries = JSON.parse(stored);
        for (const [k, v] of Object.entries(entries)) {
            cache.set(k, v as string);
        }
    }
} catch { /* ignore */ }

function saveCache(): void {
    try {
        const obj: Record<string, string> = {};
        cache.forEach((v, k) => { obj[k] = v; });
        localStorage.setItem(CACHE_KEY, JSON.stringify(obj));
    } catch { /* ignore */ }
}

// In-flight promises to avoid duplicate requests
const inflight = new Map<string, Promise<string | null>>();

/**
 * Resolve a stop ID to a name. Returns cached result instantly if available.
 * If not cached, fetches from ResRobot and caches the result.
 */
export async function resolveStopName(stopId: string): Promise<string | null> {
    if (!stopId) return null;

    // Check cache
    const cached = cache.get(stopId);
    if (cached) return cached;

    // Avoid duplicate in-flight requests
    if (inflight.has(stopId)) return inflight.get(stopId)!;

    const promise = (async (): Promise<string | null> => {
        if (!API_KEYS.RESROBOT_API_KEY) return null;

        try {
            const isDev = window.location.hostname === 'localhost';
            const baseUrl = isDev ? '/resrobot-proxy' : 'https://api.resrobot.se';
            // ResRobot location.name endpoint resolves stop IDs to names
            const url = `${baseUrl}/v2.1/location.name?id=${encodeURIComponent(stopId)}&format=json&accessId=${API_KEYS.RESROBOT_API_KEY}&maxNo=1`;

            const res = await fetch(url);
            if (!res.ok) return null;

            const data = await res.json();
            const stops = data?.stopLocationOrCoordLocation || data?.StopLocation || [];

            let name: string | null = null;

            if (Array.isArray(stops) && stops.length > 0) {
                const stop = stops[0]?.StopLocation || stops[0];
                name = stop?.name || stop?.altName || null;
            }

            if (name) {
                // Clean up the name: remove " (Region)" suffix
                name = name.replace(/\s*\([^)]*\)\s*$/, '').trim();
                cache.set(stopId, name);
                saveCache();
            }

            return name;
        } catch (e) {
            console.warn('[StopResolver] Failed for', stopId, e);
            return null;
        } finally {
            inflight.delete(stopId);
        }
    })();

    inflight.set(stopId, promise);
    return promise;
}

/**
 * Get a cached stop name synchronously. Returns null if not cached.
 */
export function getCachedStopName(stopId: string): string | null {
    return cache.get(stopId) || null;
}

/**
 * Bulk resolve: trigger resolution for multiple stop IDs in background.
 */
export function prefetchStopNames(stopIds: string[]): void {
    for (const id of stopIds) {
        if (!cache.has(id) && !inflight.has(id)) {
            resolveStopName(id); // fire and forget
        }
    }
}
