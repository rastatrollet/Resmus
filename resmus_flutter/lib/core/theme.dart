import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  static final darkTheme = ThemeData.dark().copyWith(
    scaffoldBackgroundColor: const Color(0xFF0F172A), // Deep blue/slate
    primaryColor: const Color(0xFF38BDF8), // Light blue
    colorScheme: const ColorScheme.dark(
      primary: Color(0xFF38BDF8),
      secondary: Color(0xFF818CF8), // Indigo
      surface: Color(0xFF1E293B),
      background: Color(0xFF0F172A),
    ),
    textTheme: GoogleFonts.interTextTheme(ThemeData.dark().textTheme),
    useMaterial3: true,
  );

  static BoxDecoration get glassDecoration => BoxDecoration(
        color: Colors.white.withOpacity(0.05),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: Colors.white.withOpacity(0.1),
          width: 1,
        ),
      );
}
