import { useState, useEffect } from 'react';
import { TrafiklabService } from '../services/trafiklabService';

interface JourneyStop {
    id: string;
    name: string;
    arrTime: string | null;
    depTime: string | null;
    rtArrTime: string | null;
    rtDepTime: string | null;
    track: string | null;
    routeIdx: string;
}

interface UseJourneyDetailsResult {
    loading: boolean;
    error: string | null;
    details: { stops: JourneyStop[] } | null;
}

export const useJourneyDetails = (journeyRef: string | null): UseJourneyDetailsResult => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [details, setDetails] = useState<{ stops: JourneyStop[] } | null>(null);

    useEffect(() => {
        if (!journeyRef) {
            setDetails(null);
            return;
        }

        const fetchDetails = async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await TrafiklabService.getJourneyDetails(journeyRef);
                if (data) {
                    setDetails(data);
                } else {
                    setError("Kunde inte hämta resedetaljer.");
                }
            } catch (err) {
                setError("Ett fel inträffade vid hämtning av resedetaljer.");
            } finally {
                setLoading(false);
            }
        };

        fetchDetails();
    }, [journeyRef]);

    return { loading, error, details };
};
