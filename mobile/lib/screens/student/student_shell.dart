import 'package:flutter/material.dart';

import '../../models/book.dart';
import 'books_screen.dart';
import 'selected_books_screen.dart';
import 'student_home.dart';
import 'student_profile.dart';
import 'student_qr_screen.dart';

class StudentShell extends StatefulWidget {
  final Map<String, dynamic> user;

  const StudentShell({
    super.key,
    required this.user,
  });

  @override
  State<StudentShell> createState() => _StudentShellState();
}

class _StudentShellState extends State<StudentShell> {
  int _currentIndex = 0;

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
      final index = _selectedBooks.indexWhere(
        (item) => item.id == book.id,
      );

      if (index >= 0) {
        _selectedBooks.removeAt(index);
      } else {
        _selectedBooks.add(book);
      }
    });
  }

  void _removeBook(Book book) {
    setState(() {
      _selectedBooks.removeWhere(
        (item) => item.id == book.id,
      );
    });
  }

  void _clearSelectedBooks() {
    setState(() {
      _selectedBooks.clear();
    });
  }

  @override
  Widget build(BuildContext context) {
    final pages = <Widget>[
      const StudentHome(),

      BooksScreen(
        selectedBooks: _selectedBooks,
        onToggleBook: _toggleBook,
      ),

      SelectedBooksScreen(
        userId: _userId,
        selectedBooks: _selectedBooks,
        onRemoveBook: _removeBook,
        onRequestSuccess: _clearSelectedBooks,
      ),

      const StudentQrScreen(),

      const StudentProfile(),
    ];

    return Scaffold(
      body: SafeArea(
        child: IndexedStack(
          index: _currentIndex,
          children: pages,
        ),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (index) {
          setState(() {
            _currentIndex = index;
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
              child: const Icon(
                Icons.shopping_bag_outlined,
              ),
            ),
            selectedIcon: Badge(
              isLabelVisible: _selectedBooks.isNotEmpty,
              label: Text('${_selectedBooks.length}'),
              child: const Icon(
                Icons.shopping_bag,
              ),
            ),
            label: 'Selected',
          ),
          const NavigationDestination(
            icon: Icon(Icons.qr_code_2_outlined),
            selectedIcon: Icon(Icons.qr_code_2),
            label: 'QR',
          ),
          const NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person),
            label: 'Profile',
          ),
        ],
      ),
    );
  }
}