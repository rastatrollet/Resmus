import { useEffect, useState, useRef } from 'react';

export interface VersionInfo {
    version: string;
    message: string;
    timestamp: string;
}

export const useUpdateChecker = () => {
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [updateInfo, setUpdateInfo] = useState<VersionInfo | null>(null);
    const initialVersion = useRef<string | null>(null);

    // Initial check and setup polling
    useEffect(() => {
        const fetchVersion = async (isInitial = false) => {
            try {
                // Determine base URL dynamically
                const baseUrl = import.meta.env.BASE_URL.endsWith('/')
                    ? import.meta.env.BASE_URL
                    : `${import.meta.env.BASE_URL}/`;

                // Add timestamp to prevent caching
                const res = await fetch(`${baseUrl}version.json?t=${Date.now()}`);
                if (!res.ok) return;

                const data: VersionInfo = await res.json();

                if (isInitial) {
                    initialVersion.current = data.version;
                    // console.log("Initial version:", data.version);
                } else {
                    if (initialVersion.current && data.version !== initialVersion.current) {
                        // console.log(`New version found: ${data.version} (current: ${initialVersion.current})`);
                        setUpdateInfo(data);
                        setUpdateAvailable(true);
                    }
                }
            } catch (e) {
                console.error("Failed to check for updates", e);
            }
        };

        // Initial fetch to set baseline
        fetchVersion(true);

        // Check every 60 seconds
        const interval = setInterval(() => fetchVersion(false), 60000);
        return () => clearInterval(interval);
    }, []);

    const updateNow = () => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(registrations => {
                for (let registration of registrations) {
                    registration.update();
                }
            });
        }
        window.location.reload();
    };

    const dismiss = () => {
        setUpdateAvailable(false);
    };

    return { hasUpdate: updateAvailable, updateInfo, updateNow, dismiss };
};
