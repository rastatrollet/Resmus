class Station {
  final String id;
  final String name;
  final String provider;
  final Coordinates? coords;

  Station({
    required this.id,
    required this.name,
    this.provider = 'VASTTRAFIK',
    this.coords,
  });
}

class Coordinates {
  final double lat;
  final double lng;

  Coordinates({required this.lat, required this.lng});
}

class Departure {
  final String id;
  final String line;
  final String direction;
  final String time;
  final String? timestamp;
  final String? realtime;
  final String track;
  final String provider;
  final String status; // 'ON_TIME', 'LATE', 'CANCELLED'
  final String? bgColor;
  final String? fgColor;
  final String? journeyRef;
  final bool hasDisruption;
  final String? disruptionSeverity;
  final String? disruptionMessage;
  final String type; // 'BUS', 'TRAM', 'TRAIN', 'FERRY', 'WALK'

  Departure({
    required this.id,
    required this.line,
    required this.direction,
    required this.time,
    this.timestamp,
    this.realtime,
    required this.track,
    required this.provider,
    required this.status,
    this.bgColor,
    this.fgColor,
    this.journeyRef,
    this.hasDisruption = false,
    this.disruptionSeverity,
    this.disruptionMessage,
    required this.type,
  });
}
