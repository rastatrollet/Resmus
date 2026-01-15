export interface Weather {
    temp: number;
    condition: string;
    icon: string;
}

export const WeatherService = {
    getWeather: async (lat: number, lon: number): Promise<Weather | null> => {
        try {
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`;
            const res = await fetch(url);
            if (!res.ok) return null;
            const data = await res.json();

            const code = data.current.weather_code;
            const temp = Math.round(data.current.temperature_2m);

            // Map WMO codes to simple conditions
            // 0: Clear sky
            // 1, 2, 3: Mainly clear, partly cloudy, and overcast
            // 45, 48: Fog
            // 51, 53, 55: Drizzle
            // 61, 63, 65: Rain
            // 71, 73, 75: Snow
            // 95: Thunderstorm

            let condition = 'Soligt';
            let icon = 'sun'; // lucid icon name logic could be handled in component

            if (code > 0 && code <= 3) { condition = 'Molnigt'; icon = 'cloud'; }
            else if (code >= 45 && code <= 48) { condition = 'Dimma'; icon = 'cloud-fog'; }
            else if (code >= 51 && code <= 67) { condition = 'Regn'; icon = 'cloud-rain'; }
            else if (code >= 71 && code <= 86) { condition = 'Snö'; icon = 'snowflake'; }
            else if (code >= 95) { condition = 'Åska'; icon = 'cloud-lightning'; }

            return { temp, condition, icon };
        } catch (e) {
            console.error("Weather fetch failed", e);
            return null;
        }
    }
};
