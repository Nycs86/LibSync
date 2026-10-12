import 'package:flutter/material.dart';

import '../services/auth_service.dart';
import 'role_screen.dart';

class DashboardScreen extends StatelessWidget {
  final Map<String, dynamic> user;

  const DashboardScreen({
    super.key,
    required this.user,
  });

  Future<void> logout(BuildContext context) async {
    await AuthService.logout();

    if (!context.mounted) return;

    Navigator.pushAndRemoveUntil(
      context,
      MaterialPageRoute(
        builder: (_) => const RoleScreen(),
      ),
      (route) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    final role = user['role'] ?? '';
    final name = user['name'] ?? 'User';

    return Scaffold(
      appBar: AppBar(
        title: const Text('LibSync'),
        actions: [
          IconButton(
            onPressed: () => logout(context),
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Welcome, $name!',
              style: const TextStyle(
                fontSize: 26,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Role: ${role.toString().toUpperCase()}',
              style: const TextStyle(
                fontSize: 16,
                color: Colors.grey,
              ),
            ),
            const SizedBox(height: 30),

            const Card(
              child: ListTile(
                leading: Icon(Icons.dashboard),
                title: Text('Dashboard'),
                subtitle: Text(
                  'LibSync mobile is connected.',
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}