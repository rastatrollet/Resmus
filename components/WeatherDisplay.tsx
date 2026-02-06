import React, { useEffect, useState } from 'react';
import { Cloud, CloudRain, Sun, CloudSnow, CloudLightning, Wind, CloudFog, CloudDrizzle, X, CalendarDays } from 'lucide-react';

interface WeatherDisplayProps {
    lat: number;
    lon: number;
}

export const WeatherDisplay: React.FC<WeatherDisplayProps> = ({ lat, lon }) => {
    const [weather, setWeather] = useState<{ temp: number, code: number } | null>(null);
    const [forecast, setForecast] = useState<any[]>([]); // { date, code, max, min }
    const [showForecast, setShowForecast] = useState(false);

    useEffect(() => {
        if (!lat || !lon) return;

        const fetchWeather = async () => {
            try {
                // Fetch current + 4 days (open-meteo returns today + next days)
                const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=4`);
                if (!res.ok) return;
                const data = await res.json();

                if (data.current_weather) {
                    setWeather({
                        temp: data.current_weather.temperature,
                        code: data.current_weather.weathercode
                    });
                }

                if (data.daily) {
                    const days = data.daily.time.map((t: string, i: number) => ({
                        date: t,
                        code: data.daily.weathercode[i],
                        max: data.daily.temperature_2m_max[i],
                        min: data.daily.temperature_2m_min[i]
                    }));
                    // Skip today (index 0), show next 3 days
                    setForecast(days.slice(1, 4));
                }
            } catch (e) { console.error("Weather fetch failed", e); }
        };

        fetchWeather();
        // Refresh every 30 mins
        const interval = setInterval(fetchWeather, 30 * 60 * 1000);
        return () => clearInterval(interval);
    }, [lat, lon]);

    const getWeatherIcon = (code: number, size = 16) => {
        // WMO Weather interpretation codes (WW)
        if (code === 0) return <Sun size={size} className="text-yellow-500 fill-yellow-500/20" />;
        if (code >= 1 && code <= 3) return <Cloud size={size} className="text-slate-400 fill-slate-200/50" />;
        if (code >= 45 && code <= 48) return <CloudFog size={size} className="text-slate-400" />;
        if (code >= 51 && code <= 55) return <CloudDrizzle size={size} className="text-sky-400" />;
        if (code >= 61 && code <= 67) return <CloudRain size={size} className="text-sky-500" />;
        if (code >= 71 && code <= 77) return <CloudSnow size={size} className="text-slate-200" />;
        if (code >= 80 && code <= 82) return <CloudRain size={size} className="text-sky-600" />;
        if (code >= 85 && code <= 86) return <CloudSnow size={size} className="text-slate-200" />;
        if (code >= 95 && code <= 99) return <CloudLightning size={size} className="text-yellow-600" />;
        return <Sun size={size} className="text-yellow-500 fill-yellow-500/20" />;
    };

    if (!weather) return null;

    return (
        <div className="relative">
            {/* Main Badge */}
            <button
                onClick={() => setShowForecast(!showForecast)}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border transition-all active:scale-95 ${showForecast || forecast.length > 0 ? 'bg-sky-50 dark:bg-sky-900/20 border-sky-100 dark:border-sky-800/30 hover:bg-sky-100 dark:hover:bg-sky-800/40 cursor-pointer' : 'bg-sky-50 dark:bg-sky-900/20 border-sky-100 dark:border-sky-800/30'}`}
                title="Klicka för 3-dygnsprognos"
            >
                {getWeatherIcon(weather.code)}
                <span className="text-sm font-bold text-slate-700 dark:text-sky-100">{Math.round(weather.temp)}°C</span>
            </button>

            {/* Forecast Popover */}
            {showForecast && forecast.length > 0 && (
                <>
                    {/* Backdrop to close */}
                    <div className="fixed inset-0 z-40" onClick={() => setShowForecast(false)} />

                    <div className="absolute top-full left-0 mt-2 z-50 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-100 dark:border-slate-800 p-3 w-48 animate-in fade-in zoom-in-95 slide-in-from-top-2 origin-top-left">
                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                <CalendarDays size={12} />
                                Prognos
                            </span>
                            <button onClick={() => setShowForecast(false)} className="text-slate-300 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                                <X size={14} />
                            </button>
                        </div>
                        <div className="space-y-2.5">
                            {forecast.map((day) => {
                                const date = new Date(day.date);
                                const dayName = date.toLocaleDateString('sv-SE', { weekday: 'long' });
                                const capDay = dayName.charAt(0).toUpperCase() + dayName.slice(1);

                                return (
                                    <div key={day.date} className="flex items-center justify-between group">
                                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 w-16 truncate" title={capDay}>
                                            {capDay}
                                        </span>
                                        <div className="flex items-center gap-2 flex-1 justify-end">
                                            {getWeatherIcon(day.code, 14)}
                                            <span className="text-xs font-bold text-slate-800 dark:text-white tabular-nums">
                                                {Math.round(day.max)}°
                                            </span>
                                            <span className="text-[10px] text-slate-400 font-medium tabular-nums w-4 text-right">
                                                {Math.round(day.min)}°
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
