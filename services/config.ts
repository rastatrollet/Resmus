// HÄR KLISTRAR DU IN DINA RIKTIGA NYCKLAR
export const API_KEYS = {
  // Västtrafik Planera Resa v4 (Client Credentials Base64)
  VASTTRAFIK_AUTH: import.meta.env.VITE_VASTTRAFIK_AUTH || "bG9kZ1FVSGxjOTVzZFlsQTBmazZWQjluYWVrYTpTcDdXUDJKY2xaTGpHRDVYV190azhpbUVkTWNh",
  // Trafiklab GTFS Regional Realtime Key
  TRAFIKLAB_API_KEY: import.meta.env.VITE_TRAFIKLAB_API_KEY || "600ef54ef3234bd1880624c148baa8f7",
  // Trafiklab GTFS Regional Static Key
  TRAFIKLAB_STATIC_KEY: import.meta.env.VITE_TRAFIKLAB_STATIC_KEY || "07e9c042923d42cf8ec3189056c7ea60",
  // ResRobot v2.1
  RESROBOT_API_KEY: import.meta.env.VITE_RESROBOT_API_KEY || "d1adb079-6671-4598-a6b5-8b66a871b11b",
};

export const API_URLS = {
  // Västtrafik v4 & TS v1
  VASTTRAFIK_TOKEN: "https://ext-api.vasttrafik.se/token",
  VASTTRAFIK_API: "https://ext-api.vasttrafik.se/pr/v4",
  VASTTRAFIK_TS_API: "https://ext-api.vasttrafik.se/ts/v1",
  VASTTRAFIK_GEO_API: "https://ext-api.vasttrafik.se/geo/v3",
  VASTTRAFIK_SPP_API: "https://ext-api.vasttrafik.se/spp/v3",
  // Trafiklab GTFS Realtime (Sweden-wide)
  TRAFIKLAB_GTFS_RT: "https://opendata.samtrafiken.se/gtfs-rt/sweden/VehiclePositions.pb",
  // Trafiklab SIRI ITxPT (JSON-based vehicle positions)
  TRAFIKLAB_SIRI_URL: "https://opendata.samtrafiken.se/siri-itxpt/VehicleMonitoring",
  // ResRobot v2.1
  RESROBOT_API: "https://api.resrobot.se/v2.1",
  // New Trafiklab Realtime API
  TRAFIKLAB_REALTIME_API: "https://realtime-api.trafiklab.se/v1",
};

export const TRAFIKLAB_OPERATORS = [
  { id: 'dintur', name: 'Västernorrland (Din Tur)', lat: 62.3908, lng: 17.3069 },
  { id: 'sl', name: 'Stockholm (SL)', lat: 59.3293, lng: 18.0686 },
  { id: 'ul', name: 'Uppsala (UL)', lat: 59.8586, lng: 17.6389 },
  { id: 'skane', name: 'Skåne', lat: 55.6050, lng: 13.0038 },
  { id: 'otraf', name: 'Östergötland', lat: 58.4108, lng: 15.6214 },
];




export const getTrafiklabGTFSUrl = (operator: string) => {
  return `https://opendata.samtrafiken.se/gtfs-rt/${operator}/VehiclePositions.pb`;
};