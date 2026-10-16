import 'package:flutter/material.dart';

class StudentProfile extends StatelessWidget {
  const StudentProfile({super.key});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(18),
      children: [
        const Text(
          'Profile',
          style: TextStyle(
            fontSize: 28,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 24),

        Center(
          child: CircleAvatar(
            radius: 46,
            backgroundColor: const Color(0xFFE7F2EE),
            child: Icon(
              Icons.person,
              size: 48,
              color: Theme.of(context).colorScheme.primary,
            ),
          ),
        ),
        const SizedBox(height: 14),
        const Center(
          child: Text(
            'Student',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
        const SizedBox(height: 4),
        const Center(
          child: Text(
            'Profile data will be connected to the logged-in user next.',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Color(0xFF77827B),
            ),
          ),
        ),
      ],
    );
  }
}
