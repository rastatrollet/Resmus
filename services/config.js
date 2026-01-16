
export const API_KEYS = {
    VASTTRAFIK_AUTH: "",
    TRAFIKLAB_API_KEY: "",
    TRAFIKLAB_STATIC_KEY: "",
    RESROBOT_API_KEY: "d1adb079-6671-4598-a6b5-8b66a871b11b",
};

export const API_URLS = {
    VASTTRAFIK_TOKEN: "https://ext-api.vasttrafik.se/token",
    VASTTRAFIK_API: "https://ext-api.vasttrafik.se/pr/v4",
    VASTTRAFIK_TS_API: "https://ext-api.vasttrafik.se/ts/v1",
    VASTTRAFIK_GEO_API: "https://ext-api.vasttrafik.se/geo/v3",
    VASTTRAFIK_SPP_API: "https://ext-api.vasttrafik.se/spp/v3",
    TRAFIKLAB_GTFS_RT: "https://opendata.samtrafiken.se/gtfs-rt/sweden/VehiclePositions.pb",
    TRAFIKLAB_SIRI_URL: "https://opendata.samtrafiken.se/siri-itxpt/VehicleMonitoring",
    RESROBOT_API: "https://api.resrobot.se/v2.1",
    TRAFIKLAB_REALTIME_API: "https://realtime-api.trafiklab.se/v1",
};

export const TRAFIKLAB_OPERATORS = [
    { id: 'dintur', name: 'Västernorrland (Din Tur)', lat: 62.3908, lng: 17.3069 },
    { id: 'sl', name: 'Stockholm (SL)', lat: 59.3293, lng: 18.0686 },
    { id: 'ul', name: 'Uppsala (UL)', lat: 59.8586, lng: 17.6389 },
    { id: 'skane', name: 'Skåne', lat: 55.6050, lng: 13.0038 },
    { id: 'otraf', name: 'Östergötland', lat: 58.4108, lng: 15.6214 },
];

export const getTrafiklabGTFSUrl = (operator) => {
    return `https://opendata.samtrafiken.se/gtfs-rt/${operator}/VehiclePositions.pb`;
};
