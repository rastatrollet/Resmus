import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/transit_models.dart';

class FavoritesProvider extends ChangeNotifier {
  List<Station> _favorites = [];

  List<Station> get favorites => _favorites;

  FavoritesProvider() {
    _loadFavorites();
  }

  Future<void> _loadFavorites() async {
    final prefs = await SharedPreferences.getInstance();
    final String? favsJson = prefs.getString('resmus_favorites');
    if (favsJson != null) {
      try {
        final List<dynamic> decoded = jsonDecode(favsJson);
        _favorites = decoded.map((item) => Station(
          id: item['id'],
          name: item['name'],
          provider: item['provider'] ?? 'VASTTRAFIK',
          coords: item['coords'] != null ? Coordinates(lat: item['coords']['lat'], lng: item['coords']['lng']) : null
        )).toList();
        notifyListeners();
      } catch (e) {
        if (kDebugMode) print("Error loading favorites: $e");
      }
    }
  }

  Future<void> toggleFavorite(Station station) async {
    final isFav = _favorites.any((s) => s.id == station.id);
    if (isFav) {
      _favorites.removeWhere((s) => s.id == station.id);
    } else {
      _favorites.add(station);
    }
    notifyListeners();
    _saveFavorites();
  }

  bool isFavorite(Station station) {
    return _favorites.any((s) => s.id == station.id);
  }

  Future<void> _saveFavorites() async {
    final prefs = await SharedPreferences.getInstance();
    final data = _favorites.map((s) => {
      'id': s.id,
      'name': s.name,
      'provider': s.provider,
      'coords': s.coords != null ? {'lat': s.coords!.lat, 'lng': s.coords!.lng} : null
    }).toList();
    await prefs.setString('resmus_favorites', jsonEncode(data));
  }
}
