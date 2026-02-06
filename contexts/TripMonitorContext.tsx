import React, { createContext, useContext, ReactNode } from 'react';
import { useTripMonitor, MonitoredTrip } from '../hooks/useTripMonitor';
import { Departure } from '../types';

interface TripMonitorContextType {
    monitoredTrips: MonitoredTrip[];
    addTrip: (dep: Departure) => Promise<void>;
    removeTrip: (id: string) => void;
    isMonitored: (id: string) => boolean;
}

const TripMonitorContext = createContext<TripMonitorContextType | undefined>(undefined);

export const TripMonitorProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { monitoredTrips, addTrip, removeTrip, isMonitored } = useTripMonitor();

    return (
        <TripMonitorContext.Provider value={{ monitoredTrips, addTrip, removeTrip, isMonitored }}>
            {children}
        </TripMonitorContext.Provider>
    );
};

export const useTripMonitorContext = () => {
    const context = useContext(TripMonitorContext);
    if (!context) {
        throw new Error('useTripMonitorContext must be used within a TripMonitorProvider');
    }
    return context;
};
