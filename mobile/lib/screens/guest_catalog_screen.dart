import 'package:flutter/material.dart';

import '../models/book.dart';
import 'register_screen.dart';
import 'student/books_screen.dart';

/// No authenticated student screens are constructed in guest mode.
/// Books are fetched through the public catalogue API only.
class GuestCatalogScreen extends StatelessWidget {
  const GuestCatalogScreen({super.key});

  Future<void> _requireLogin(BuildContext context) async {
    final decision = await showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Login Required'),
        content: const Text(
          'You can view books as a guest, but you need a student '
          'account to borrow. Log in or create an account to continue.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Keep Browsing'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, 'register'),
            child: const Text('Create Account'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, 'login'),
            child: const Text('Login'),
          ),
        ],
      ),
    );

    if (!context.mounted) return;
    if (decision == 'login') {
      // LoginScreen is the previous route; no guest token/session exists.
      Navigator.of(context).pop();
    } else if (decision == 'register') {
      // Pop guest page back to LoginScreen, then push RegisterScreen
      // using its navigator. The registration screen can pop back to Login.
      Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => const RegisterScreen()),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF064E3B),
        title: const Text('LibSync · Guest',
            style: TextStyle(fontWeight: FontWeight.w800)),
        actions: [
          TextButton.icon(
            onPressed: () => Navigator.of(context).pop(),
            icon: const Icon(Icons.login),
            label: const Text('Login'),
          ),
        ],
      ),
      body: BooksScreen(
        guestMode: true,
        selectedBooks: const <Book>[],
        onToggleBook: (_) {},
        onGuestBorrow: () => _requireLogin(context),
      ),
    );
  }
}
