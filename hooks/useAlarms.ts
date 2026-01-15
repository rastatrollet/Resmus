import { useState, useEffect } from 'react';

export type Alarm = {
    id: string; // stationName + line + time
    departureTime: string; // ISO string or original time from board
    dueTime: number; // timestamp in ms
    stationName: string;
    line: string;
    direction: string;
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

        // Request notification permission if needed
        if (Notification.permission === 'default') {
            Notification.requestPermission();
        }

        save([...alarms, alarm]);
    };

    const removeAlarm = (id: string) => {
        save(alarms.filter(a => a.id !== id));
    };

    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            alarms.forEach(alarm => {
                const diff = alarm.dueTime - now;
                // Trigger alarm 5 minutes before (300000ms), or if it's "now" (e.g. less than 1 min but not expired)
                // Let's say we notify 5 min before

                // Logic: 
                // We want to notify ONCE.
                // We can check if it's "close enough" and hasn't been notified? 
                // Or simpler: just notify when time is up minus X minutes.

                // For simplicity in this demo: Notify when 5 minutes remain
                if (diff <= 300000 && diff > 0 && diff > 290000) { // Approx 5 min mark
                    new Notification(`Avgång om 5 min!`, {
                        body: `${alarm.line} mot ${alarm.direction} från ${alarm.stationName}`,
                        icon: '/vite.svg'
                    });
                }

                // Cleanup expired alarms (10 mins after departure)
                if (diff < -600000) {
                    removeAlarm(alarm.id);
                }
            });
        }, 10000); // Check every 10s

        return () => clearInterval(interval);
    }, [alarms]);

    return { alarms, addAlarm, removeAlarm };
};
