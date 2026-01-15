import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'dart:async';
import '../../core/models/transit_models.dart';
import '../../core/services/vasttrafik_service.dart';
import '../../core/providers/favorites_provider.dart';
import '../../core/theme.dart';
import 'package:google_fonts/google_fonts.dart';

class DeparturesScreen extends StatefulWidget {
  const DeparturesScreen({super.key});

  @override
  State<DeparturesScreen> createState() => _DeparturesScreenState();
}

class _DeparturesScreenState extends State<DeparturesScreen> {
  // State
  Station? _currentStation;
  List<Departure> _departures = [];
  bool _loading = false;
  Timer? _refreshTimer;

  // Search
  final TextEditingController _searchController = TextEditingController();
  List<Station> _searchResults = [];
  bool _isSearching = false;
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    // Auto-refresh logic
    _refreshTimer = Timer.periodic(const Duration(minutes: 1), (timer) {
      if (_currentStation != null) _fetchDepartures();
    });
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    _debounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  void _onSearchChanged(String query) {
    if (_debounce?.isActive ?? false) _debounce!.cancel();
    _debounce = Timer(const Duration(milliseconds: 500), () async {
      if (query.length > 2) {
        setState(() => _isSearching = true);
        final results = await VasttrafikService.searchStations(query);
        if (mounted) {
          setState(() {
            _searchResults = results;
            _isSearching = false;
          });
        }
      } else {
        setState(() => _searchResults = []);
      }
    });

    if (query.isEmpty) {
      setState(() => _searchResults = []);
    }
  }

  void _selectStation(Station station) {
    setState(() {
      _currentStation = station;
      _searchController.clear();
      _searchResults = [];
      _departures = [];
    });
    _fetchDepartures();
  }

  Future<void> _fetchDepartures() async {
    if (_currentStation == null) return;
    setState(() => _loading = true);
    final data = await VasttrafikService.getDepartures(_currentStation!.id);
    if (mounted) {
      setState(() {
        _departures = data;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final favorites = context.watch<FavoritesProvider>().favorites;

    return Column(
      children: [
        // Search Header (Glassmorphic)
        Container(
          padding: const EdgeInsets.all(16),
          decoration: AppTheme.glassDecoration.copyWith(
            borderRadius: const BorderRadius.vertical(bottom: Radius.circular(24)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextField(
                controller: _searchController,
                onChanged: _onSearchChanged,
                style: const TextStyle(color: Colors.white),
                decoration: InputDecoration(
                  hintText: 'Sök hållplats...',
                  hintStyle: TextStyle(color: Colors.white.withOpacity(0.5)),
                  prefixIcon: const Icon(Icons.search, color: Colors.white70),
                  filled: true,
                  fillColor: Colors.white.withOpacity(0.1),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide.none,
                  ),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  suffixIcon: _isSearching
                      ? const SizedBox(width: 20, height: 20, child: Padding(
                          padding: EdgeInsets.all(10.0),
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.blue),
                        ))
                      : (_searchController.text.isNotEmpty 
                          ? IconButton(icon: const Icon(Icons.clear, color: Colors.white54), onPressed: () {
                              _searchController.clear();
                              setState(() => _searchResults = []);
                            })
                          : null),
                ),
              ),
              
              // Search Results Dropdown
              if (_searchResults.isNotEmpty)
                Container(
                  margin: const EdgeInsets.only(top: 8),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1E293B),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.white10),
                  ),
                  constraints: const BoxConstraints(maxHeight: 200),
                  child: ListView.builder(
                    shrinkWrap: true,
                    itemCount: _searchResults.length,
                    itemBuilder: (context, index) {
                      final s = _searchResults[index];
                      return ListTile(
                        leading: const Icon(Icons.place, color: Colors.blue, size: 20),
                        title: Text(s.name, style: const TextStyle(color: Colors.white)),
                        onTap: () => _selectStation(s),
                        trailing: IconButton(
                          icon: Icon(
                            context.read<FavoritesProvider>().isFavorite(s) ? Icons.star : Icons.star_border,
                            color: Colors.yellow,
                          ),
                          onPressed: () => context.read<FavoritesProvider>().toggleFavorite(s),
                        ),
                      );
                    },
                  ),
                ),
            ],
          ),
        ),

        // Content
        Expanded(
          child: _currentStation == null
              ? _buildFavoritesView(favorites)
              : _buildDeparturesList(),
        ),
      ],
    );
  }

  Widget _buildFavoritesView(List<Station> favorites) {
    if (favorites.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.star_border, size: 64, color: Colors.white.withOpacity(0.2)),
            const SizedBox(height: 16),
            Text("Inga favoriter än", 
              style: GoogleFonts.inter(color: Colors.white54, fontSize: 16, fontWeight: FontWeight.bold)
            ),
          ],
        ),
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: favorites.length,
      itemBuilder: (context, index) {
        final fav = favorites[index];
        return Card(
          color: Colors.white.withOpacity(0.05),
          margin: const EdgeInsets.only(bottom: 8),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          child: ListTile(
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            leading: divCircle(Icons.star, Colors.amber),
            title: Text(fav.name, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
            onTap: () => _selectStation(fav),
            trailing: IconButton(
              icon: const Icon(Icons.delete_outline, color: Colors.white30),
              onPressed: () => context.read<FavoritesProvider>().toggleFavorite(fav),
            ),
          ),
        );
      },
    );
  }

  Widget _buildDeparturesList() {
    return Column(
      children: [
        // Station Header
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          color: Colors.blue.withOpacity(0.1),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(_currentStation!.name, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white)),
              IconButton( // Close/Back
                icon: const Icon(Icons.close, color: Colors.white),
                onPressed: () => setState(() => _currentStation = null),
              ),
            ],
          ),
        ),
        
        // List
        Expanded(
          child: _loading && _departures.isEmpty
              ? const Center(child: CircularProgressIndicator())
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: _departures.length,
                  itemBuilder: (context, index) {
                    final dep = _departures[index];
                    return _buildDepartureRow(dep);
                  },
                ),
        ),
      ],
    );
  }

  Widget _buildDepartureRow(Departure dep) {
    // Helper to parse colors
    Color parseColor(String? c, Color def) {
       if (c == null) return def;
       try {
         return Color(int.parse(c.replaceAll('#', '0xFF')));
       } catch (e) {
         return def;
       }
    }

    final bg = parseColor(dep.bgColor, Colors.blue);
    final fg = parseColor(dep.fgColor, Colors.white);

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.05),
        borderRadius: BorderRadius.circular(12),
        border: Border(left: BorderSide(color: bg, width: 4)),
      ),
      child: Row(
        children: [
          // Line Badge
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: bg,
              borderRadius: BorderRadius.circular(6),
              boxShadow: [BoxShadow(color: bg.withOpacity(0.4), blurRadius: 4)],
            ),
            constraints: const BoxConstraints(minWidth: 40),
            child: Text(
              dep.line,
              textAlign: TextAlign.center,
              style: TextStyle(color: fg, fontWeight: FontWeight.bold, fontSize: 14),
            ),
          ),
          const SizedBox(width: 12),
          // Destination
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  dep.direction,
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 15),
                  overflow: TextOverflow.ellipsis,
                ),
                if (dep.status == 'CANCELLED')
                  const Text('INSTÄLLD', style: TextStyle(color: Colors.redAccent, fontSize: 10, fontWeight: FontWeight.bold)),
              ],
            ),
          ),
          // Time
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                dep.realtime ?? dep.time,
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
              ),
              if (dep.realtime != null && dep.realtime != dep.time)
                Text(
                  dep.time,
                  style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 12, decoration: TextDecoration.lineThrough),
                ),
            ],
          ),
          const SizedBox(width: 12),
          // Track
          if (dep.track.isNotEmpty)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.1),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(dep.track, style: const TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.bold)),
            ),
        ],
      ),
    );
  }
  
  Widget divCircle(IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: color.withOpacity(0.2),
        shape: BoxShape.circle,
      ),
      child: Icon(icon, color: color, size: 20),
    );
  }
}
