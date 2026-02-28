// API Keys - använder GitHub Secrets i production
export const API_KEYS = {
  // Västtrafik Planera Resa v4 (Client Credentials Base64)
  VASTTRAFIK_AUTH: "bG9kZ1FVSGxjOTVzZFlsQTBmazZWQjluYWVrYTpTcDdXUDJKY2xaTGpHRDVYV190azhpbUVkTWNh",
  // Trafiklab GTFS Regional Realtime Key
  TRAFIKLAB_API_KEY: "600ef54ef3234bd1880624c148baa8f7",
  // Trafiklab GTFS Regional Static Key (kept as fallback)
  TRAFIKLAB_STATIC_KEY: "07e9c042923d42cf8ec3189056c7ea60",
  // Trafiklab NeTEx Regional Static Key (Resmus2 project – 11/50 requests used)
  NETEX_STATIC_KEY: "ca21d237580b40cb8302c02de9735b84",
  // ResRobot v2.1
  RESROBOT_API_KEY: "d1adb079-6671-4598-a6b5-8b66a871b11b",
  // Trafikverket API (Tåg)
  TRAFIKVERKET_API_KEY: "6f63f23e56054e1d8447269c150280f4",
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
  // ResRobot v2.1 (Use local proxy in DEV to avoid CORS/500 errors)
  RESROBOT_API: import.meta.env.DEV ? "/resrobot-api" : "https://api.resrobot.se/v2.1",
  // New Trafiklab Realtime API
  TRAFIKLAB_REALTIME_API: "https://realtime-api.trafiklab.se/v1",
};

export const TRAFIKLAB_OPERATORS = [
  { id: 'sweden', name: 'Hela Sverige (Samlat)', lat: 62.0, lng: 15.0 }, // Aggregerad feed
  { id: 'sl', name: 'Stockholm (SL)', lat: 59.3293, lng: 18.0686 },
  { id: 'ul', name: 'Uppsala (UL)', lat: 59.8586, lng: 17.6389 },
  { id: 'otraf', name: 'Östergötland', lat: 58.4108, lng: 15.6214 }, // & Occupancy
  { id: 'jlt', name: 'Jönköping (JLT)', lat: 57.7826, lng: 14.1618 },
  { id: 'krono', name: 'Kronoberg', lat: 56.8777, lng: 14.8091 },
  { id: 'klt', name: 'Kalmar (KLT)', lat: 56.6634, lng: 16.3568 },
  { id: 'gotland', name: 'Gotland', lat: 57.6348, lng: 18.2948 },
  { id: 'skane', name: 'Skåne', lat: 55.6050, lng: 13.0038 }, // & Occupancy
  { id: 'varm', name: 'Värmland', lat: 59.3789, lng: 13.5016 },
  { id: 'orebro', name: 'Örebro', lat: 59.2753, lng: 15.2134 },
  { id: 'vastmanland', name: 'Västmanland', lat: 59.6107, lng: 16.5448 },
  { id: 'dt', name: 'Dalarna', lat: 60.6067, lng: 15.6355 },
  { id: 'xt', name: 'Gävleborg (X-trafik)', lat: 60.6749, lng: 17.1413 },
  { id: 'dintur', name: 'Västernorrland (Din Tur)', lat: 62.3908, lng: 17.3069 },
  { id: 'halland', name: 'Halland', lat: 56.6744, lng: 12.8568 },
  { id: 'entur', name: '🇳🇴 Norge (Entur)', lat: 59.9139, lng: 10.7522 },
];




export const getTrafiklabGTFSUrl = (operator: string) => {
  return `https://opendata.samtrafiken.se/gtfs-rt/${operator}/VehiclePositions.pb`;
};