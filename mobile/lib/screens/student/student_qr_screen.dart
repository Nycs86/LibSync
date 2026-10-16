import 'package:flutter/material.dart';

class StudentQrScreen extends StatelessWidget {
  const StudentQrScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(18),
      children: [
        const Text(
          'Borrowing QR',
          style: TextStyle(
            fontSize: 28,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 5),
        const Text(
          'Your active Borrow QR or Return QR will appear here.',
          style: TextStyle(
            color: Color(0xFF77827B),
          ),
        ),
        const SizedBox(height: 70),
        Container(
          padding: const EdgeInsets.all(28),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: const Color(0xFFE4E8E5),
            ),
          ),
          child: const Column(
            children: [
              Icon(
                Icons.qr_code_2_rounded,
                size: 110,
                color: Color(0xFF0B6B57),
              ),
              SizedBox(height: 18),
              Text(
                'No active QR yet',
                style: TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 18,
                ),
              ),
              SizedBox(height: 6),
              Text(
                'Once a request is approved, the Borrow QR will appear here. '
                'After the books are released, it will be replaced by the Return QR.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Color(0xFF77827B),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
