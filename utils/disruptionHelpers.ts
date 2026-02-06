import { TrafficSituation } from '../types';

export const formatDisruption = (disruption: TrafficSituation) => {
    if (!disruption) return null;

    // Translate Status/Categories
    // This is often in 'consequence' or purely in text.
    // We can look at severity or other fields.

    const mapStatus = (text: string) => {
        if (!text) return "";
        const t = text.toUpperCase();
        if (t.includes('CANCEL') || t.includes('INSTÄLLD')) return "Inställd avgång";
        if (t.includes('DELAY') || t.includes('FÖRSEN')) return "Förseningar";
        if (t.includes('PLAN') || t.includes('ARBETE')) return "Banarbete / Underhåll";
        return "Trafikinfo";
    };

    const status = mapStatus(disruption.title || disruption.description);

    // Format Date (Swedish)
    // Assuming disruption.startTime is ISO string
    const formatDate = (dateStr: string) => {
        if (!dateStr) return "";
        const d = new Date(dateStr);
        const now = new Date();
        const isToday = d.toDateString() === now.toDateString();

        // Swedish locale options
        if (isToday) {
            return `Idag ${d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}`;
        } else {
            // e.g. "Mån 12 feb"
            return d.toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' });
        }
    };

    return {
        title: disruption.title || status,
        description: disruption.description,
        statusText: status, // The translated short status
        startTime: formatDate(disruption.startTime),
        endTime: disruption.endTime ? formatDate(disruption.endTime) : null
    };
};
