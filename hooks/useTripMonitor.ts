import { useState, useEffect, useCallback } from 'react';
import { Departure, Provider } from '../types';
import { TransitService } from '../services/transitService';

interface LastTripState {
    time: string; // ISO Timestamp or HH:MM best guess
    rtTime?: string; // HH:MM
    track: string;
    status: string;
    hasWarned10Min?: boolean;
}

export interface MonitoredTrip {
    id: string; // Departure ID
    stationId: string;
    stationName: string;
    line: string;
    direction: string;
    provider: Provider;
    scheduledTime: string; // HH:MM
    lastState: LastTripState;
}

export const useTripMonitor = () => {
    const [monitoredTrips, setMonitoredTrips] = useState<MonitoredTrip[]>(() => {
        try {
            const saved = localStorage.getItem('monitored_trips');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            return [];
        }
    });

    // Persist to LocalStorage
    useEffect(() => {
        localStorage.setItem('monitored_trips', JSON.stringify(monitoredTrips));
    }, [monitoredTrips]);

    const requestPermission = async () => {
        if (!("Notification" in window)) return false;
        if (Notification.permission === "granted") return true;
        if (Notification.permission !== "denied") {
            const permission = await Notification.requestPermission();
            return permission === "granted";
        }
        return false;
    };

    const sendNotification = (title: string, body: string) => {
        if (Notification.permission === "granted") {
            try {
                // Try/Catch for mobile browsers that might be strict
                // @ts-ignore
                if (navigator.serviceWorker && navigator.serviceWorker.ready) {
                    // @ts-ignore
                    navigator.serviceWorker.ready.then(registration => {
                        // Only show if supported
                        if (registration.showNotification) {
                            registration.showNotification(title, {
                                body,
                                icon: '/icon-192x192.png',
                                tag: 'resmus-monitor',
                                vibrate: [200, 100, 200]
                            } as any);
                        } else {
                            new Notification(title, { body, icon: '/icon-192x192.png', tag: 'resmus-monitor' });
                        }
                    });
                } else {
                    new Notification(title, { body, icon: '/icon-192x192.png', tag: 'resmus-monitor' });
                }
            } catch (e) {
                // Fallback
                new Notification(title, { body, icon: '/icon-192x192.png', tag: 'resmus-monitor' });
            }
        }
    };

    const addTrip = async (dep: Departure) => {
        const granted = await requestPermission();
        if (!granted) {
            alert("Du måste tillåta notiser för att kunna bevaka resor.");
            return;
        }

        // Prevent duplicates (simple check by ID or Line+Dir+Time)
        const isAlreadyMonitored = monitoredTrips.some(t => t.id === dep.id);
        if (isAlreadyMonitored) {
            removeTrip(dep.id); // Toggle off if clicked again
            return;
        }

        const newTrip: MonitoredTrip = {
            id: dep.id,
            stationId: dep.stopPoint.gid,
            stationName: dep.stopPoint.name,
            line: dep.line,
            direction: dep.direction,
            provider: dep.provider,
            scheduledTime: dep.time,
            lastState: {
                time: dep.timestamp || new Date().toISOString(), // Use full timestamp for calculations
                rtTime: dep.realtime,
                track: dep.track,
                status: dep.status,
                hasWarned10Min: false
            }
        };

        setMonitoredTrips(prev => [...prev, newTrip]);
        sendNotification("Bevakning startad", `Bevakar ${dep.line} mot ${dep.direction}`);
    };

    const removeTrip = (id: string) => {
        setMonitoredTrips(prev => prev.filter(t => t.id !== id));
    };

    const isMonitored = (id: string) => monitoredTrips.some(t => t.id === id);

    // Helper: Calculate diff in minutes between two ISO strings or Dates
    const getDiffMinutes = (timeA: string, timeB: string) => {
        const dateA = new Date(timeA);
        const dateB = new Date(timeB);
        return (dateA.getTime() - dateB.getTime()) / 60000;
    };

    // Helper: Get minutes from NOW
    const getMinutesFromNow = (time: string) => {
        const now = new Date();
        const target = new Date(time);
        return (target.getTime() - now.getTime()) / 60000;
    };

    // Polling Effect
    useEffect(() => {
        if (monitoredTrips.length === 0) return;

        const checkUpdates = async () => {
            // Group by station/provider to minimize calls
            const groups: Record<string, MonitoredTrip[]> = {};
            monitoredTrips.forEach(t => {
                const key = `${t.provider}|${t.stationId}`;
                if (!groups[key]) groups[key] = [];
                groups[key].push(t);
            });

            for (const key in groups) {
                const [provider, stationId] = key.split('|');
                const tripsToCheck = groups[key];

                try {
                    // Fetch updated departures
                    // Use a reasonable duration window (e.g., 60-120 mins) to ensure we find the trip
                    const departures = await TransitService.getDepartures(
                        stationId,
                        provider as Provider,
                        'departures',
                        undefined,
                        120
                    );

                    // Iterate monitored trips for this group
                    for (const trip of tripsToCheck) {
                        // Find match
                        // Strategy: Match ID first. If not found, Match Line + Direction + ScheduledTime (approx)
                        let match = departures.find(d => d.id === trip.id);

                        if (!match) {
                            // Fuzzy match fallback (IDs might change if realtime provider changes ref)
                            match = departures.find(d =>
                                d.line === trip.line &&
                                d.direction === trip.direction &&
                                // Check if time is within reasonable window (e.g. +/- 5 mins of original schedule)
                                Math.abs(getDiffMinutes(d.time, trip.scheduledTime)) < 30 // Rough check, timestamps are better
                                // Ideally check d.time === trip.scheduledTime
                            );
                        }

                        if (!match) continue; // Trip not found (maybe too far in future or passed?)

                        const newState = {
                            time: match.timestamp || match.datetime || new Date().toISOString(),
                            rtTime: match.realtime,
                            track: match.track,
                            status: match.status
                        };

                        const oldState = trip.lastState;
                        let shouldUpdate = false;
                        let updatedState = { ...oldState };

                        // 1. Check Cancellations
                        if (match.status === 'CANCELLED' && oldState.status !== 'CANCELLED') {
                            sendNotification("Inställd!", `${trip.line} mot ${trip.direction} har ställts in.`);
                            updatedState.status = 'CANCELLED';
                            shouldUpdate = true;
                        }

                        // 2. Platform Change
                        if (match.track && match.track !== oldState.track) {
                            sendNotification("Nytt Läge", `${trip.line} mot ${trip.direction} går från läge ${match.track}.`);
                            updatedState.track = match.track;
                            shouldUpdate = true;
                        }

                        // 3. Delay Check (> 2 min diff from LAST SAVED time)
                        const diff = getDiffMinutes(newState.time, oldState.time);
                        if (Math.abs(diff) >= 2) {
                            const delayStr = diff > 0 ? `${Math.round(diff)} min sen` : `${Math.round(Math.abs(diff))} min tidigare`;
                            // Only notify if we haven't notified for this specific delay?
                            // The logic "diff from last saved" implies we update 'last saved' after notifying.
                            sendNotification("Ny Tid", `${trip.line} mot ${trip.direction} är ${delayStr}. Ny tid: ${match.realtime || match.time}`);
                            updatedState.time = newState.time; // Update base time
                            shouldUpdate = true;
                        }

                        // 4. 10 Minute Warning
                        const minsLeft = getMinutesFromNow(newState.time);
                        if (minsLeft <= 10 && minsLeft > 0 && !oldState.hasWarned10Min) {
                            sendNotification("Avgår snart", `${trip.line} mot ${trip.direction} avgår om ca ${Math.round(minsLeft)} min.`);
                            updatedState.hasWarned10Min = true;
                            shouldUpdate = true;
                        }

                        if (shouldUpdate) {
                            setMonitoredTrips(prev => prev.map(t => t.id === trip.id ? { ...t, lastState: updatedState } : t));
                        }
                    }

                } catch (e) {
                    console.error("Monitor polling failed for", key, e);
                }
            }
        };

        const interval = setInterval(checkUpdates, 60000); // Poll every 60s
        return () => clearInterval(interval);
    }, [monitoredTrips]);

    return { monitoredTrips, addTrip, removeTrip, isMonitored };
};
