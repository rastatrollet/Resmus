import React, { useEffect, useState } from 'react';
import { Cloud, CloudRain, Sun, CloudSnow, CloudLightning, Wind, CloudFog, CloudDrizzle } from 'lucide-react';

interface WeatherDisplayProps {
    lat: number;
    lon: number;
}

export const WeatherDisplay: React.FC<WeatherDisplayProps> = ({ lat, lon }) => {
    const [weather, setWeather] = useState<{ temp: number, code: number } | null>(null);

    useEffect(() => {
        if (!lat || !lon) return;

        const fetchWeather = async () => {
            try {
                const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
                if (!res.ok) return;
                const data = await res.json();
                if (data.current_weather) {
                    setWeather({
                        temp: data.current_weather.temperature,
                        code: data.current_weather.weathercode
                    });
                }
            } catch (e) { console.error("Weather fetch failed", e); }
        };

        fetchWeather();
        // Refresh every 30 mins
        const interval = setInterval(fetchWeather, 30 * 60 * 1000);
        return () => clearInterval(interval);
    }, [lat, lon]);

    const getWeatherIcon = (code: number) => {
        // WMO Weather interpretation codes (WW)
        if (code === 0) return <Sun size={16} className="text-yellow-500 fill-yellow-500/20" />;
        if (code >= 1 && code <= 3) return <Cloud size={16} className="text-slate-400 fill-slate-200/50" />;
        if (code >= 45 && code <= 48) return <CloudFog size={16} className="text-slate-400" />;
        if (code >= 51 && code <= 55) return <CloudDrizzle size={16} className="text-sky-400" />;
        if (code >= 61 && code <= 67) return <CloudRain size={16} className="text-sky-500" />;
        if (code >= 71 && code <= 77) return <CloudSnow size={16} className="text-slate-200" />;
        if (code >= 80 && code <= 82) return <CloudRain size={16} className="text-sky-600" />;
        if (code >= 85 && code <= 86) return <CloudSnow size={16} className="text-slate-200" />;
        if (code >= 95 && code <= 99) return <CloudLightning size={16} className="text-yellow-600" />;
        return <Sun size={16} className="text-yellow-500 fill-yellow-500/20" />;
    };

    if (!weather) return null;

    return (
        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-sky-50 dark:bg-sky-900/20 rounded-full border border-sky-100 dark:border-sky-800/30 animate-in fade-in" title="Nuvarande väder (OpenMeteo)">
            {getWeatherIcon(weather.code)}
            <span className="text-sm font-bold text-slate-700 dark:text-sky-100">{Math.round(weather.temp)}°C</span>
        </div>
    );
};
