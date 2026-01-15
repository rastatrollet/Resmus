import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart'; // Assume it will be there, if not I fix.
import '../core/theme.dart';

import '../features/departures/departures_screen.dart';
import '../features/map/live_map_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _currentIndex = 0;

  final List<Widget> _screens = const [
    DeparturesScreen(),
    LiveMapScreen(),
    Center(child: Text("Trip Planner")),
    Center(child: Text("Settings")),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          // Background Gradient
          Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  Color(0xFF0F172A),
                  Color(0xFF1E293B),
                ],
              ),
            ),
          ),
          // Content
          SafeArea(child: _screens[_currentIndex]),
        ],
      ),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: const Color(0xFF1E293B).withOpacity(0.8),
          border: Border(top: BorderSide(color: Colors.white.withOpacity(0.1))),
        ),
        child: BottomNavigationBar(
          currentIndex: _currentIndex,
          onTap: (index) => setState(() => _currentIndex = index),
          backgroundColor: Colors.transparent,
          elevation: 0,
          selectedItemColor: Theme.of(context).primaryColor,
          unselectedItemColor: Colors.grey,
          type: BottomNavigationBarType.fixed,
          items: const [
            BottomNavigationBarItem(
              icon: Icon(Icons.departure_board),
              label: 'Avgångar',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.map),
              label: 'Karta',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.directions),
              label: 'Resa',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.settings),
              label: 'Inställningar',
            ),
          ],
        ),
      ),
    );
  }
}
