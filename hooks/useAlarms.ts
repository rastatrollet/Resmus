import { useState, useEffect } from 'react';

export type Alarm = {
    id: string; // stationName + line + time
    departureTime: string; // ISO string 
    dueTime: number; // timestamp in ms
    stationName: string;
    line: string;
    direction: string;
    notified?: boolean; // Track if we have already sent the departure notification
    arrivalTime?: string; // ISO string for final destination arrival
    arrivalNotified?: boolean; // Track if we sent the arrival notification
    journeyRef?: string; // Reference to track delays/cancellations
    lastKnownRealtime?: string; // Last known realtime for delay detection
    delayNotified?: boolean; // Track if we notified about delay
    cancellationNotified?: boolean; // Track if we notified about cancellation
};

export const useAlarms = () => {
    const [alarms, setAlarms] = useState<Alarm[]>([]);

    useEffect(() => {
        const stored = localStorage.getItem('resmus_alarms');
        if (stored) {
            setAlarms(JSON.parse(stored));
        }
    }, []);

    const save = (newAlarms: Alarm[]) => {
        setAlarms(newAlarms);
        localStorage.setItem('resmus_alarms', JSON.stringify(newAlarms));
    };

    const addAlarm = (alarm: Alarm) => {
        if (alarms.some(a => a.id === alarm.id)) return;

        // Request notification permission if needed (and supported)
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }

        save([...alarms, alarm]);
    };

    const removeAlarm = (id: string) => {
        save(alarms.filter(a => a.id !== id));
    };

    const markAsNotified = (id: string) => {
        save(alarms.map(a => a.id === id ? { ...a, notified: true } : a));
    };

    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            alarms.forEach(alarm => {
                // Cleanup expired alarms (10 mins after arrival or departure if no arrival)
                const finalTime = alarm.arrivalTime ? new Date(alarm.arrivalTime).getTime() : new Date(alarm.departureTime).getTime();
                if (now > finalTime + 600000) {
                    removeAlarm(alarm.id);
                    return;
                }

                // Calculate time until departure
                const departureTimestamp = new Date(alarm.departureTime).getTime();
                const diffDeparture = departureTimestamp - now;

                // 1. DEPARTURE NOTIFICATION (5 minutes before)
                const FIVE_MINUTES = 300000;
                if (!alarm.notified && diffDeparture <= FIVE_MINUTES && diffDeparture > 0) {
                    if (Notification.permission === 'granted') {
                        try {
                            new Notification(`Avgång om 5 min! 🚌`, {
                                body: `Linje ${alarm.line} mot ${alarm.direction} går snart från ${alarm.stationName}.`,
                                icon: '/vite.svg',
                                tag: alarm.id + '-departure'
                            });
                        } catch (e) {
                            console.error("Notification error:", e);
                        }
                    }
                    markAsNotified(alarm.id);
                }

                // 2. ARRIVAL NOTIFICATION (10 minutes before arrival at final destination)
                if (alarm.arrivalTime && !alarm.arrivalNotified) {
                    const arrivalTimestamp = new Date(alarm.arrivalTime).getTime();
                    const diffArrival = arrivalTimestamp - now;
                    const TEN_MINUTES = 600000;

                    if (diffArrival <= TEN_MINUTES && diffArrival > 0) {
                        if (Notification.permission === 'granted') {
                            try {
                                new Notification(`Du ankommer snart! 🎯`, {
                                    body: `Linje ${alarm.line} ankommer till ${alarm.direction} om ca 10 minuter.`,
                                    icon: '/vite.svg',
                                    tag: alarm.id + '-arrival'
                                });
                            } catch (e) {
                                console.error("Notification error:", e);
                            }
                        }
                        // Mark arrival as notified
                        save(alarms.map(a => a.id === alarm.id ? { ...a, arrivalNotified: true } : a));
                    }
                }

                // 3. DELAY NOTIFICATION (if realtime changes significantly)
                // This would require periodic API checks, which is complex
                // For now, we'll skip this as it requires background API polling

                // 4. CANCELLATION NOTIFICATION
                // This also requires API polling, skipping for now
            });
        }, 10000); // Check every 10s

        return () => clearInterval(interval);
    }, [alarms]);

    return { alarms, addAlarm, removeAlarm };
};
