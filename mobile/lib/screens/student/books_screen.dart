import 'package:flutter/material.dart';

import '../../models/book.dart';
import '../../services/book_service.dart';

class BooksScreen extends StatefulWidget {
  const BooksScreen({super.key});

  @override
  State<BooksScreen> createState() => _BooksScreenState();
}

class _BooksScreenState extends State<BooksScreen> {
  late Future<List<Book>> _future;
  String _query = '';
  bool _availableOnly = false;

  @override
  void initState() {
    super.initState();
    _future = BookService.getBooks();
  }

  void _reload() {
    setState(() {
      _future = BookService.getBooks();
    });
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<Book>>(
      future: _future,
      builder: (context, snapshot) {
        final books = snapshot.data ?? const <Book>[];

        final filtered = books.where((book) {
          final term = _query.trim().toLowerCase();

          final matchesQuery = term.isEmpty ||
              book.title.toLowerCase().contains(term) ||
              book.author.toLowerCase().contains(term) ||
              (book.isbn ?? '').toLowerCase().contains(term);

          final matchesAvailability =
              !_availableOnly || book.isAvailable;

          return matchesQuery && matchesAvailability;
        }).toList();

        return ListView(
          padding: const EdgeInsets.fromLTRB(18, 18, 18, 28),
          children: [
            const Text(
              'Books',
              style: TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 4),
            const Text(
              'Browse the LibSync library catalog.',
              style: TextStyle(
                color: Color(0xFF77827B),
              ),
            ),
            const SizedBox(height: 18),

            TextField(
              onChanged: (value) {
                setState(() => _query = value);
              },
              decoration: InputDecoration(
                hintText: 'Search title, author, or ISBN',
                prefixIcon: const Icon(Icons.search),
                filled: true,
                fillColor: Colors.white,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
            ),
            const SizedBox(height: 10),

            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Available books only'),
              value: _availableOnly,
              onChanged: (value) {
                setState(() => _availableOnly = value);
              },
            ),
            const SizedBox(height: 10),

            if (snapshot.connectionState ==
                ConnectionState.waiting)
              const Padding(
                padding: EdgeInsets.only(top: 80),
                child: Center(
                  child: CircularProgressIndicator(),
                ),
              )
            else if (snapshot.hasError)
              Center(
                child: Column(
                  children: [
                    const SizedBox(height: 60),
                    Text('${snapshot.error}'),
                    const SizedBox(height: 12),
                    FilledButton(
                      onPressed: _reload,
                      child: const Text('Retry'),
                    ),
                  ],
                ),
              )
            else if (filtered.isEmpty)
              const Padding(
                padding: EdgeInsets.only(top: 70),
                child: Center(
                  child: Text('No matching books found.'),
                ),
              )
            else
              ...filtered.map(
                (book) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: _BookCard(book: book),
                ),
              ),
          ],
        );
      },
    );
  }
}

class _BookCard extends StatelessWidget {
  final Book book;

  const _BookCard({
    required this.book,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(15),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(
          color: const Color(0xFFE4E8E5),
        ),
        borderRadius: BorderRadius.circular(17),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 66,
            height: 92,
            decoration: BoxDecoration(
              color: const Color(0xFFE8F5F0),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(
              Icons.menu_book_rounded,
              color: Color(0xFF0B6B57),
              size: 30,
            ),
          ),
          const SizedBox(width: 14),

          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  book.title,
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  book.author,
                  style: const TextStyle(
                    color: Color(0xFF77827B),
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  book.category ?? 'General',
                  style: const TextStyle(
                    fontSize: 12,
                  ),
                ),
                const SizedBox(height: 9),

                Row(
                  children: [
                    Expanded(
                      child: Text(
                        book.isAvailable
                            ? '${book.availableQuantity} available'
                            : 'Unavailable',
                        style: TextStyle(
                          color: book.isAvailable
                              ? const Color(0xFF16825E)
                              : Colors.redAccent,
                          fontWeight: FontWeight.w700,
                          fontSize: 12,
                        ),
                      ),
                    ),
                    FilledButton.tonal(
                      onPressed: book.isAvailable
                          ? () {
                              ScaffoldMessenger.of(context)
                                  .showSnackBar(
                                SnackBar(
                                  content: Text(
                                    '${book.title} selected. '
                                    'Selection state will be connected next.',
                                  ),
                                ),
                              );
                            }
                          : null,
                      child: const Text('Select'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
