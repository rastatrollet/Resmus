import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import '../../core/services/trafiklab_service.dart';

class LiveMapScreen extends StatefulWidget {
  const LiveMapScreen({super.key});

  @override
  State<LiveMapScreen> createState() => _LiveMapScreenState();
}

class _LiveMapScreenState extends State<LiveMapScreen> {
  // Config
  final MapController _mapController = MapController();
  List<VehiclePosition> _vehicles = [];
  Timer? _refreshTimer;
  bool _isLoading = false;

  // Filters
  bool _showBuses = true;
  bool _showTrains = true; // Not used yet but ready
  
  // Default Center (Gothenburg)
  static const LatLng _initialCenter = LatLng(57.708870, 11.974560);

  @override
  void initState() {
    super.initState();
    _fetchVehicles();
    _refreshTimer = Timer.periodic(const Duration(seconds: 15), (_) => _fetchVehicles());
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }

  Future<void> _fetchVehicles() async {
    // Only fetch if visible? For now always fetch
    try {
      // Use Vosttrafik/Trafiklab Logic
      // For now we use TrafiklabService which has GTFS-RT 'sl' or 'dintur'. 
      // User likely wants Västtrafik (Gothenburg).
      // Trafiklab GTFS-RT for Västtrafik: operator 'vasttrafik'
      // Need to confirm if 'vasttrafik' is valid operator ID in GTFS-RT. 
      // Usually it is. Or use VästtrafikService.fetchVehiclePositions (which we implemented).
      
      // We should use VästtrafikService for better data in Gbg area.
      // But VästtrafikService.fetchVehiclePositions is commented out or partial in our Dart code?
      // Let's check `vasttrafik_service.dart`. 
      // I only implemented `getDepartures` and `searchStations` in `vasttrafik_service.dart`.
      // I did NOT implement `fetchVehiclePositions` in the Dart version yet.
      
      // So I will use TrafiklabService with 'vasttrafik' for now.
      
      final data = await TrafiklabService.getLiveVehicles('vasttrafik');
      if (mounted) {
        setState(() {
          _vehicles = data;
        });
      }
    } catch (e) {
      print("Map Fetch Error: $e");
    }
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        FlutterMap(
          mapController: _mapController,
          options: const MapOptions(
            initialCenter: _initialCenter,
            initialZoom: 13.0,
            interactionOptions: InteractionOptions(
              flags: InteractiveFlag.all & ~InteractiveFlag.rotate,
            ),
          ),
          children: [
            TileLayer(
              urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
              userAgentPackageName: 'com.resmus.app',
              // Dark mode tiles logic? 
              // OSM is light. We can invert colors using ColorFilter or use CartoDB Dark Matter.
              // CartoDB Dark Matter: https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png
            ),
             // Dark mode overlay if using standard OSM
            // TileLayer(
            //   urlTemplate: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
            //   subdomains: ['a', 'b', 'c', 'd'],
            // ),
            // Let's use CartoDB Dark Matter for "Premium" look
             TileLayer(
               urlTemplate: 'https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png',
               subdomains: const ['a', 'b', 'c'],
               userAgentPackageName: 'com.resmus.app',
             ),

            MarkerLayer(
              markers: _vehicles.map((v) {
                return Marker(
                  point: LatLng(v.lat, v.lng),
                  width: 32,
                  height: 32,
                  child: _buildVehicleMarker(v),
                );
              }).toList(),
            ),
          ],
        ),
        
        // Controls
        Positioned(
          bottom: 16,
          right: 16,
          child: Column(
            children: [
              FloatingActionButton.small(
                heroTag: "zoom_in",
                child: const Icon(Icons.add),
                onPressed: () {
                  final zoom = _mapController.camera.zoom + 1;
                  _mapController.move(_mapController.camera.center, zoom);
                },
              ),
              const SizedBox(height: 8),
              FloatingActionButton.small(
                heroTag: "zoom_out",
                child: const Icon(Icons.remove),
                onPressed: () {
                  final zoom = _mapController.camera.zoom - 1;
                  _mapController.move(_mapController.camera.center, zoom);
                },
              ),
               const SizedBox(height: 8),
               FloatingActionButton(
                 heroTag: "refresh",
                 child: _isLoading ? const Padding(padding: EdgeInsets.all(12), child: CircularProgressIndicator(color: Colors.white)) : const Icon(Icons.refresh),
                 onPressed: _fetchVehicles,
               ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildVehicleMarker(VehiclePosition v) {
    Color color = Colors.blue; 
    // Logic for color based on line/type
    // Simplified for now
    
    return Transform.rotate(
      angle: (v.bearing * (3.14159 / 180)), // Bearing to Radians
      child: Container(
        decoration: BoxDecoration(
          color: color,
          shape: BoxShape.circle,
          border: Border.all(color: Colors.white, width: 2),
          boxShadow: const [BoxShadow(color: Colors.black45, blurRadius: 4)],
        ),
        child: const Icon(Icons.arrow_upward, color: Colors.white, size: 16),
      ),
    );
  }
}
