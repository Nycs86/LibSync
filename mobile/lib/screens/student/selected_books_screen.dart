import 'package:flutter/material.dart';

class SelectedBooksScreen extends StatelessWidget {
  const SelectedBooksScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(18),
      children: [
        const Text(
          'Selected Books',
          style: TextStyle(
            fontSize: 28,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 5),
        const Text(
          'Your selected books will appear here.',
          style: TextStyle(
            color: Color(0xFF77827B),
          ),
        ),
        const SizedBox(height: 70),
        Icon(
          Icons.shopping_bag_outlined,
          size: 64,
          color: Theme.of(context).colorScheme.primary,
        ),
        const SizedBox(height: 16),
        const Center(
          child: Text(
            'No selected books yet',
            style: TextStyle(
              fontWeight: FontWeight.w700,
              fontSize: 17,
            ),
          ),
        ),
        const SizedBox(height: 6),
        const Center(
          child: Text(
            'Next we will connect this screen to the borrow request flow.',
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
