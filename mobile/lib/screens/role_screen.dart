import 'package:flutter/material.dart';

import 'login_screen.dart';

class RoleScreen extends StatelessWidget {
  const RoleScreen({super.key});

  void openLogin(
    BuildContext context,
    String role,
    String title,
  ) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => LoginScreen(
          role: role,
          title: title,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(
                Icons.local_library_rounded,
                size: 90,
                color: Color(0xFF1D4ED8),
              ),
              const SizedBox(height: 16),
              const Text(
                'LibSync',
                style: TextStyle(
                  fontSize: 34,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Library Management System',
                style: TextStyle(
                  color: Colors.grey,
                ),
              ),
              const SizedBox(height: 50),

              roleButton(
                context,
                icon: Icons.admin_panel_settings,
                title: 'Admin',
                role: 'admin',
              ),

              const SizedBox(height: 14),

              roleButton(
                context,
                icon: Icons.menu_book,
                title: 'Librarian',
                role: 'librarian',
              ),

              const SizedBox(height: 14),

              roleButton(
                context,
                icon: Icons.school,
                title: 'Student',
                role: 'student',
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget roleButton(
    BuildContext context, {
    required IconData icon,
    required String title,
    required String role,
  }) {
    return SizedBox(
      width: double.infinity,
      height: 65,
      child: ElevatedButton.icon(
        onPressed: () => openLogin(
          context,
          role,
          title,
        ),
        icon: Icon(icon),
        label: Text(
          title,
          style: const TextStyle(
            fontSize: 18,
          ),
        ),
      ),
    );
  }
}