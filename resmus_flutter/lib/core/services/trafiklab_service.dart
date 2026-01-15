import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../config.dart';

class VehiclePosition {
  final String id;
  final String line;
  final String direction;
  final double lat;
  final double lng;
  final double bearing;
  final double? speed;
  final String type;
  final String operatorId;

  VehiclePosition({
    required this.id,
    required this.line,
    required this.direction,
    required this.lat,
    required this.lng,
    required this.bearing,
    this.speed,
    required this.type,
    required this.operatorId,
  });
}

class TrafiklabService {
  static Future<List<VehiclePosition>> getLiveVehicles(String operatorId) async {
    final apiKey = AppConfig.apiKeys['TRAFIKLAB_API_KEY'];
    if (apiKey == null || operatorId.isEmpty) return [];

    final url = Uri.parse(
        "https://opendata.samtrafiken.se/gtfs-rt/$operatorId/VehiclePositions.pb?key=$apiKey&format=JSON");

    try {
      final response = await http.get(url, headers: {'Accept': 'application/json'});
      if (response.statusCode != 200) {
        if (kDebugMode) {
          print("GTFS-RT fetch failed: ${response.statusCode}");
        }
        return [];
      }

      final data = jsonDecode(response.body);
      final entities = data['entity'] ?? data['entities'] ?? data['FeedEntity'] ?? [];

      if (entities is! List) return [];

      final List<VehiclePosition> vehicles = [];

      for (var entity in entities) {
        final v = entity['vehicle'] ?? entity['VehiclePosition'] ?? entity['vehicle_position'];
        if (v == null) continue;

        final pos = v['position'] ?? v['Position'];
        if (pos == null) continue;

        final trip = v['trip'] ?? v['Trip'];
        final vehicle = v['vehicle'] ?? v['Vehicle'];

        final lat = pos['latitude'] ?? pos['lat'] ?? pos['Latitude'] ?? pos['Lat'];
        final lng = pos['longitude'] ?? pos['lng'] ?? pos['Longitude'] ?? pos['Lng'];

        if (lat == null || lng == null) continue;

        // Determine line
        String line = trip?['route_id'] ?? trip?['routeId'] ?? trip?['RouteId'] ?? vehicle?['label'] ?? vehicle?['Label'] ?? "?";
        
        // Clean up line logic (port from TS)
        if (line.length > 10) {
          final label = vehicle?['label'] ?? vehicle?['Label'];
          if (label != null && label is String && label.length < 10) {
            line = label;
          }
        }

        vehicles.add(VehiclePosition(
          id: vehicle?['id'] ?? vehicle?['Id'] ?? entity['id'] ?? entity['Id'] ?? DateTime.now().millisecondsSinceEpoch.toString(),
          line: line.toString(),
          direction: "Se rutt",
          lat: (lat is num) ? lat.toDouble() : double.tryParse(lat.toString()) ?? 0.0,
          lng: (lng is num) ? lng.toDouble() : double.tryParse(lng.toString()) ?? 0.0,
          bearing: (pos['bearing'] ?? pos['Bearing'] ?? 0).toDouble(),
          speed: (pos['speed'] ?? pos['Speed'])?.toDouble(),
          type: 'BUS',
          operatorId: operatorId,
        ));
      }

      return vehicles;
    } catch (e) {
      if (kDebugMode) {
        print("Error fetching GTFS-RT positions: $e");
      }
      return [];
    }
  }
}
