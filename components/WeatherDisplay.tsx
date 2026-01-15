import { Cloud, CloudFog, CloudLightning, CloudRain, CloudSun, Snowflake, Sun } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { WeatherService, Weather } from '../services/WeatherService';

const WeatherIcon = ({ icon, size }: { icon: string, size?: number }) => {
    const s = size || 18;
    switch (icon) {
        case 'sun': return <Sun size={s} className="text-amber-500" />;
        case 'cloud': return <Cloud size={s} className="text-slate-400" />;
        case 'cloud-rain': return <CloudRain size={s} className="text-blue-400" />;
        case 'snowflake': return <Snowflake size={s} className="text-sky-300" />;
        case 'cloud-lightning': return <CloudLightning size={s} className="text-purple-500" />;
        case 'cloud-fog': return <CloudFog size={s} className="text-slate-300" />;
        default: return <CloudSun size={s} className="text-slate-400" />;
    }
};

export const WeatherDisplay = ({ lat, lon }: { lat: number, lon: number }) => {
    const [weather, setWeather] = useState<Weather | null>(null);

    useEffect(() => {
        if (lat && lon) {
            WeatherService.getWeather(lat, lon).then(setWeather);
        }
    }, [lat, lon]);

    if (!weather) return null;

    return (
        <div className="flex items-center gap-1.5 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm px-2 py-1 rounded-full border border-white/20 dark:border-white/10 shadow-sm animate-in fade-in zoom-in mx-2">
            <WeatherIcon icon={weather.icon} size={14} />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{weather.temp}°</span>
        </div>
    );
};
