import { useState, useEffect } from 'react';

export type Alarm = {
    id: string; // stationName + line + time
    departureTime: string; // ISO string 
    dueTime: number; // timestamp in ms
    stationName: string;
    line: string;
    direction: string;
    notified?: boolean; // Track if we have already sent the notification
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
                if (alarm.notified) {
                    // Cleanup expired alarms (10 mins after departure)
                    if (now > alarm.dueTime + 600000) { // dueTime is actually departureTime? No, check logic.
                        // Ideally check against actual departure time, but dueTime logic in addAlarm was confusing.
                        // Let's assume dueTime is DEPARTURE time.
                        if (now > (new Date(alarm.departureTime).getTime() + 600000)) {
                            removeAlarm(alarm.id);
                        }
                    }
                    return;
                }

                // Calculate time until departure
                const departureTimestamp = new Date(alarm.departureTime).getTime();
                const diff = departureTimestamp - now;

                // Notify if within 5-6 minutes (300000ms - 360000ms range) OR if "late" add (e.g., user adds alarm 2 mins before)
                // New logic: Notify when <= 5 minutes remain 
                const FIVE_MINUTES = 300000;

                if (diff <= FIVE_MINUTES && diff > 0) {
                    if (Notification.permission === 'granted') {
                        try {
                            new Notification(`Avgång om 5 min! 🚌`, {
                                body: `Linje ${alarm.line} mot ${alarm.direction} går snart från ${alarm.stationName}.`,
                                icon: '/vite.svg', // Ensure this exists or use text
                                tag: alarm.id // Prevent duplicate notifications
                            });
                        } catch (e) {
                            console.error("Notification error:", e);
                        }
                    }

                    // Also play sound? (Optional, maybe later)
                    markAsNotified(alarm.id);
                }
                // Fallback for immediate notification if added late (< 5 mins)
                else if (diff <= 0 && diff > -60000) {
                    // Departed?
                }
            });
        }, 10000); // Check every 10s

        return () => clearInterval(interval);
    }, [alarms]); // Re-run when alarms change (includes notified updates)

    return { alarms, addAlarm, removeAlarm };
};
