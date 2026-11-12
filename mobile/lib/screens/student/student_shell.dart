import 'package:flutter/material.dart';

import '../../models/book.dart';
import 'books_screen.dart';
import 'selected_books_screen.dart';
import 'student_home.dart';
import 'student_profile.dart';
import 'student_qr_screen.dart';
import 'student_history_screen.dart';

class StudentShell extends StatefulWidget {
  final Map<String, dynamic> user;

  const StudentShell({super.key, required this.user});

  @override
  State<StudentShell> createState() => _StudentShellState();
}

class _StudentShellState extends State<StudentShell> {
  static const Color primaryGreen = Color(0xFF006B50);
  static const Color darkGreen = Color(0xFF064E3B);
  static const Color mintGreen = Color(0xFFDDF6EA);
  static const Color background = Color(0xFFF6FBF8);

  int _currentIndex = 0;
  int _qrRefreshVersion = 0;
  int _historyRefreshVersion = 0;

  final List<Book> _selectedBooks = [];

  int get _userId {
    final value = widget.user['id'];

    if (value is int) {
      return value;
    }

    return int.parse(value.toString());
  }

  void _toggleBook(Book book) {
    setState(() {
      final index = _selectedBooks.indexWhere((item) => item.id == book.id);

      if (index >= 0) {
        _selectedBooks.removeAt(index);
      } else {
        _selectedBooks.add(book);
      }
    });
  }

  void _removeBook(Book book) {
    setState(() {
      _selectedBooks.removeWhere((item) => item.id == book.id);
    });
  }

  void _handleRequestSuccess() {
    setState(() {
      _selectedBooks.clear();
      _currentIndex = 3;
      _qrRefreshVersion += 1;
      _historyRefreshVersion += 1;
    });
  }

  @override
  Widget build(BuildContext context) {
    final pages = <Widget>[
      const StudentHome(),
      BooksScreen(selectedBooks: _selectedBooks, onToggleBook: _toggleBook),
      SelectedBooksScreen(
        userId: _userId,
        selectedBooks: _selectedBooks,
        onRemoveBook: _removeBook,
        onRequestSuccess: _handleRequestSuccess,
      ),
      StudentQrScreen(userId: _userId, refreshVersion: _qrRefreshVersion),
      StudentHistoryScreen(
        userId: _userId,
        refreshVersion: _historyRefreshVersion,
      ),
      StudentProfile(userId: _userId),
    ];

    return Scaffold(
      backgroundColor: background,
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        elevation: 0,
        toolbarHeight: 70,
        automaticallyImplyLeading: false,
        titleSpacing: 20,
        title: Image.asset(
          'assets/images/logo.png',
          height: 42,
          fit: BoxFit.contain,
          errorBuilder: (context, error, stackTrace) {
            return const Text(
              'LIBSYNC',
              style: TextStyle(
                color: darkGreen,
                fontWeight: FontWeight.w900,
                letterSpacing: 1.5,
              ),
            );
          },
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 18),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: mintGreen,
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.school_outlined, color: primaryGreen, size: 17),
                  SizedBox(width: 6),
                  Text(
                    'Student',
                    style: TextStyle(
                      color: darkGreen,
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
        bottom: const PreferredSize(
          preferredSize: Size.fromHeight(1),
          child: Divider(height: 1, color: Color(0xFFE4EEE8)),
        ),
      ),
      body: SafeArea(
        top: false,
        child: IndexedStack(index: _currentIndex, children: pages),
      ),
      bottomNavigationBar: NavigationBarTheme(
        data: NavigationBarThemeData(
          backgroundColor: Colors.white,
          indicatorColor: mintGreen,
          height: 76,
          labelTextStyle: WidgetStateProperty.resolveWith(
            (states) => TextStyle(
              color: states.contains(WidgetState.selected)
                  ? primaryGreen
                  : const Color(0xFF71877D),
              fontSize: 11,
              fontWeight: states.contains(WidgetState.selected)
                  ? FontWeight.w700
                  : FontWeight.w500,
            ),
          ),
          iconTheme: WidgetStateProperty.resolveWith(
            (states) => IconThemeData(
              color: states.contains(WidgetState.selected)
                  ? primaryGreen
                  : const Color(0xFF71877D),
              size: 23,
            ),
          ),
        ),
        child: NavigationBar(
          selectedIndex: _currentIndex,
          onDestinationSelected: (index) {
            setState(() {
              _currentIndex = index;

              if (index == 3) {
                _qrRefreshVersion += 1;
              }

              if (index == 4) {
                _historyRefreshVersion += 1;
              }
            });
          },
          destinations: [
            const NavigationDestination(
              icon: Icon(Icons.home_outlined),
              selectedIcon: Icon(Icons.home),
              label: 'Home',
            ),
            const NavigationDestination(
              icon: Icon(Icons.menu_book_outlined),
              selectedIcon: Icon(Icons.menu_book),
              label: 'Books',
            ),
            NavigationDestination(
              icon: Badge(
                isLabelVisible: _selectedBooks.isNotEmpty,
                label: Text('${_selectedBooks.length}'),
                child: const Icon(Icons.shopping_bag_outlined),
              ),
              selectedIcon: Badge(
                isLabelVisible: _selectedBooks.isNotEmpty,
                label: Text('${_selectedBooks.length}'),
                child: const Icon(Icons.shopping_bag),
              ),
              label: 'Selected',
            ),
            const NavigationDestination(
              icon: Icon(Icons.qr_code_2_outlined),
              selectedIcon: Icon(Icons.qr_code_2),
              label: 'QR',
            ),
            const NavigationDestination(
              icon: Icon(Icons.history_outlined),
              selectedIcon: Icon(Icons.history),
              label: 'History',
            ),
            const NavigationDestination(
              icon: Icon(Icons.person_outline),
              selectedIcon: Icon(Icons.person),
              label: 'Profile',
            ),
          ],
        ),
      ),
    );
  }
}
