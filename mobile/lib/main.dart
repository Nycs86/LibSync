import 'package:flutter/material.dart';
import 'screens/login_screen.dart';

void main() {
  runApp(const LibSyncApp());
}

class LibSyncApp extends StatelessWidget {
  const LibSyncApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'LibSync',
      theme: ThemeData(
        useMaterial3: true,
        colorSchemeSeed: Colors.indigo,
      ),
      home: const LoginScreen(),
    );
  }
}