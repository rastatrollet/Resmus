import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../config.dart';
import '../models/transit_models.dart';

class VasttrafikService {
  static String? _accessToken;
  static DateTime? _tokenExpiry;

  static Future<String?> getAccessToken() async {
    if (_accessToken != null &&
        _tokenExpiry != null &&
        DateTime.now().isBefore(_tokenExpiry!)) {
      return _accessToken;
    }

    final auth = AppConfig.apiKeys['VASTTRAFIK_AUTH'];
    if (auth == null) return null;

    try {
      final response = await http.post(
        Uri.parse("https://ext-api.vasttrafik.se/token"),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic $auth',
        },
        body: 'grant_type=client_credentials',
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        _accessToken = data['access_token'];
        final expiresIn = data['expires_in'] as int;
        _tokenExpiry = DateTime.now().add(Duration(seconds: expiresIn - 30));
        return _accessToken;
      }
    } catch (e) {
      if (kDebugMode) print("Auth Error: $e");
    }
    return null;
  }

  static Future<List<Station>> searchStations(String query) async {
    final token = await getAccessToken();
    if (token == null) return [];

    try {
      final url = Uri.parse(
          "https://ext-api.vasttrafik.se/pr/v4/locations/by-text?q=${Uri.encodeComponent(query)}&limit=15&types=stoparea");
      final response = await http.get(url, headers: {'Authorization': 'Bearer $token'});

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final results = data['results'] as List?;
        if (results == null) return [];

        return results.map((item) => Station(
          id: item['gid'],
          name: item['name'],
          coords: item['geometry'] != null
              ? Coordinates(
                  lat: item['geometry']['latitude'],
                  lng: item['geometry']['longitude'])
              : null,
        )).toList();
      }
    } catch (e) {
      if (kDebugMode) print("Search Error: $e");
    }
    return [];
  }

  static Future<List<Departure>> getDepartures(String stationId) async {
    final token = await getAccessToken();
    if (token == null) return [];

    try {
      // Fetch departures (default mode)
      final url = Uri.parse(
          "https://ext-api.vasttrafik.se/pr/v4/stop-areas/$stationId/departures?limit=50");
      final response = await http.get(url, headers: {'Authorization': 'Bearer $token'});

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final results = data['results'] as List?;
        if (results == null) return [];

        return results.map((entry) {
            final serviceJourney = entry['serviceJourney'];
            final lineDetails = serviceJourney?['line'];
            final lineName = lineDetails?['designation'] ?? lineDetails?['name'] ?? "?";
            
            // Transport Mode Logic
            String transportMode = lineDetails?['transportMode'] ?? 'BUS';
            if (transportMode == 'BUS') {
               // Heuristic checks (simplified from TS)
               final productName = (lineDetails?['product']?['name'] ?? '').toString().toLowerCase();
               if (productName.contains('spårvagn')) transportMode = 'TRAM';
               else if (productName.contains('tåg')) transportMode = 'TRAIN';
               else if (productName.contains('färja') || productName.contains('båt')) transportMode = 'FERRY';
               
               // Tram lines 1-13 heuristic
               final lineNum = int.tryParse(lineName);
               if (lineNum != null && lineNum >= 1 && lineNum <= 13) {
                 transportMode = 'TRAM';
               }
            }

            final planned = entry['plannedTime'];
            final estimated = entry['estimatedTime'];
            final isCancelled = entry['isCancelled'] == true;

            String time = planned != null ? DateTime.parse(planned).toLocal().toString().substring(11, 16) : "00:00";
            String? realtime = estimated != null ? DateTime.parse(estimated).toLocal().toString().substring(11, 16) : null;
            
            String status = 'ON_TIME';
            if (isCancelled) status = 'CANCELLED';
            else if (estimated != null && planned != null && estimated != planned) status = 'LATE';

            // Colors
            String? bgColor = lineDetails?['backgroundColor'];
            String? fgColor = lineDetails?['foregroundColor'] ?? lineDetails?['textColor'];

            // Color fix helper (inline)
            String fixColor(String? c, String def) {
              if (c == null || c.isEmpty) return def;
              if (!c.startsWith('#')) return '#$c';
              return c;
            }

            if (lineName == 'X90') {
              bgColor = '#FFFF50';
              fgColor = '#D400A2';
            } else {
              bgColor = fixColor(bgColor, '#0ea5e9');
              fgColor = fixColor(fgColor, '#ffffff');
            }

            // Direction
            String direction = serviceJourney?['direction'] ?? "Okänd";

            return Departure(
              id: "vt-${entry['detailsReference'] ?? DateTime.now().microsecondsSinceEpoch}",
              line: lineName,
              direction: direction,
              time: time,
              timestamp: estimated ?? planned,
              realtime: realtime,
              track: entry['stopPoint']?['platform'] ?? "",
              provider: 'VASTTRAFIK',
              status: status,
              bgColor: bgColor,
              fgColor: fgColor,
              journeyRef: entry['detailsReference'],
              hasDisruption: (entry['situations'] as List?)?.isNotEmpty ?? false,
              disruptionMessage: (entry['situations'] as List?)?.isNotEmpty == true ? entry['situations'][0]['title'] : null,
              type: transportMode,
            );
        }).toList();
      }
    } catch (e) {
      if (kDebugMode) print("Departures Error: $e");
    }
    return [];
  }
}
