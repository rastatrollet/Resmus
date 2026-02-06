import React from 'react';
import { Bell } from 'lucide-react';
import { Departure } from '../types';
import { useTripMonitorContext } from '../contexts/TripMonitorContext';

interface MonitorTripButtonProps {
    departure: Departure;
    className?: string;
}

export const MonitorTripButton: React.FC<MonitorTripButtonProps> = ({ departure, className = "" }) => {
    const { isMonitored, addTrip, removeTrip } = useTripMonitorContext();
    const active = isMonitored(departure.id);

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent triggering row click
        if (active) {
            removeTrip(departure.id);
        } else {
            addTrip(departure);
        }
    };

    return (
        <button
            onClick={handleClick}
            className={`p-2 rounded-full transition-all duration-200 active:scale-90 ${active
                ? 'text-sky-500 bg-sky-50 dark:bg-sky-900/30'
                : 'text-slate-300 dark:text-slate-600 hover:text-sky-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                } ${className}`}
            title={active ? "Sluta bevaka" : "Bevaka resa"}
        >
            <Bell
                size={16}
                className={active ? "animate-pulse-slow" : ""}
                fill={active ? "currentColor" : "none"}
            />
        </button>
    );
};
