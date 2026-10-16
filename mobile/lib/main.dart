import 'package:flutter/material.dart';
import 'screens/student/student_shell.dart';

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
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF0B6B57),
          brightness: Brightness.light,
        ),
        scaffoldBackgroundColor: const Color(0xFFF8F6EF),
        cardTheme: const CardThemeData(
          elevation: 0,
          margin: EdgeInsets.zero,
        ),
      ),
      home: const StudentShell(),
    );
  }
}
