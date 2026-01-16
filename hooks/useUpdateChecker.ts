import { useEffect, useState } from 'react';
import { useToast } from '../components/ToastProvider';

interface VersionInfo {
    version: string;
    message: string;
    timestamp: string;
}

export const useUpdateChecker = () => {
    const toast = useToast();
    const [currentVersion, setCurrentVersion] = useState<string | null>(null);

    useEffect(() => {
        const checkUpdate = async () => {
            try {
                // Determine base URL dynamically (handles subdomain on standard deployments)
                const baseUrl = import.meta.env.BASE_URL.endsWith('/')
                    ? import.meta.env.BASE_URL
                    : `${import.meta.env.BASE_URL}/`;

                // Add timestamp to prevent caching
                const res = await fetch(`${baseUrl}version.json?t=${Date.now()}`);
                if (!res.ok) return;

                const data: VersionInfo = await res.json();
                const storedVersion = localStorage.getItem('resmus_version');

                // If first time loading (no stored version), just save it
                if (!storedVersion) {
                    localStorage.setItem('resmus_version', data.version);
                    setCurrentVersion(data.version);
                    return;
                }

                // If version mismatch, update available!
                if (storedVersion !== data.version) {
                    console.log(`Update found! Old: ${storedVersion}, New: ${data.version}`);

                    // Show Toast
                    toast.info(
                        "Ny uppdatering tillgänglig! 🚀",
                        `Nytt: "${data.message || 'Förbättringar och buggfixar'}"`
                    );

                    // Update stored version
                    localStorage.setItem('resmus_version', data.version);
                    setCurrentVersion(data.version);

                    // Optional: Auto-reload after a delay or let user reload manually?
                    // For a smoother experience, we just let them know. 
                    // Service Worker (if reused later) handles the hard reload mostly.
                    // But for static pages, a reload is good to fetch new assets.
                }

            } catch (e) {
                console.error("Failed to check for updates", e);
            }
        };

        // Check immediately on mount
        checkUpdate();

        // Then check every 60 seconds
        const interval = setInterval(checkUpdate, 60000);

        return () => clearInterval(interval);
    }, []);

    return currentVersion;
};
