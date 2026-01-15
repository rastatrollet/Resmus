import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'core/theme.dart';
import 'core/providers/favorites_provider.dart';
import 'ui/home_screen.dart';

void main() {
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => FavoritesProvider()),
      ],
      child: const ResmusApp(),
    ),
  );
}

class ResmusApp extends StatelessWidget {
  const ResmusApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Resmus',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.darkTheme,
      home: const HomeScreen(),
    );
  }
}
