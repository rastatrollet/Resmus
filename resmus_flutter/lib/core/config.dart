class AppConfig {
  static const apiKeys = {
    'VASTTRAFIK_AUTH': "bG9kZ1FVSGxjOTVzZFlsQTBmazZWQjluYWVrYTpTcDdXUDJKY2xaTGpHRDVYV190azhpbUVkTWNh",
    'TRAFIKLAB_API_KEY': "600ef54ef3234bd1880624c148baa8f7",
    'TRAFIKLAB_STATIC_KEY': "07e9c042923d42cf8ec3189056c7ea60",
  };

  static const apiUrls = {
    'TRAFIKLAB_GTFS_RT': "https://opendata.samtrafiken.se/gtfs-rt/sweden/VehiclePositions.pb",
  };
}

class TrafiklabOperator {
  final String id;
  final String name;
  final double lat;
  final double lng;

  const TrafiklabOperator({
    required this.id,
    required this.name,
    required this.lat,
    required this.lng,
  });
}

const trafiklabOperators = [
  TrafiklabOperator(id: 'dintur', name: 'Västernorrland (Din Tur)', lat: 62.3908, lng: 17.3069),
  TrafiklabOperator(id: 'sl', name: 'Stockholm (SL)', lat: 59.3293, lng: 18.0686),
  TrafiklabOperator(id: 'ul', name: 'Uppsala (UL)', lat: 59.8586, lng: 17.6389),
  TrafiklabOperator(id: 'skane', name: 'Skåne', lat: 55.6050, lng: 13.0038),
  TrafiklabOperator(id: 'otraf', name: 'Östergötland', lat: 58.4108, lng: 15.6214),
];
