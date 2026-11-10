
import 'package:flutter/material.dart';

import '../../models/book.dart';
import '../../services/book_service.dart';

class BooksScreen extends StatefulWidget {
  final List<Book> selectedBooks;
  final ValueChanged<Book> onToggleBook;

  const BooksScreen({
    super.key,
    required this.selectedBooks,
    required this.onToggleBook,
  });

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

  bool _isSelected(Book book) {
    return widget.selectedBooks.any(
      (item) => item.id == book.id,
    );
  }

  void _showBookDetails(Book book) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return Container(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.of(context).size.height * 0.85,
          ),
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(
              top: Radius.circular(24),
            ),
          ),
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(22),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Center(
                  child: Container(
                    width: 42,
                    height: 5,
                    decoration: BoxDecoration(
                      color: Colors.black12,
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                ),
                const SizedBox(height: 22),

                const Center(
                  child: Icon(
                    Icons.menu_book_rounded,
                    size: 55,
                    color: Color(0xFF0B6B57),
                  ),
                ),
                const SizedBox(height: 18),

                Text(
                  book.title,
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 6),

                Text(
                  'by ${book.author}',
                  style: const TextStyle(
                    color: Color(0xFF77827B),
                    fontSize: 15,
                  ),
                ),
                const SizedBox(height: 22),

                const Text(
                  'About this book',
                  style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 8),

                Text(
                  book.description?.trim().isNotEmpty == true
                      ? book.description!.trim()
                      : 'No description available for this book.',
                  style: const TextStyle(
                    height: 1.6,
                    color: Color(0xFF53615A),
                  ),
                ),
                const SizedBox(height: 22),

                const Divider(),
                const SizedBox(height: 12),

                _detailRow('ISBN', book.isbn),
                _detailRow('Category', book.category),
                _detailRow('Publisher', book.publisher),
                _detailRow(
                  'Year Published',
                  book.yearPublished?.toString(),
                ),
                _detailRow(
                  'Total Copies',
                  book.quantity.toString(),
                ),
                _detailRow(
                  'Available Copies',
                  book.availableQuantity.toString(),
                ),

                const SizedBox(height: 20),

                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: () {
                      Navigator.pop(context);
                    },
                    child: const Text('Close'),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _detailRow(String label, String? value) {
    if (value == null || value.trim().isEmpty) {
      return const SizedBox.shrink();
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 125,
            child: Text(
              label,
              style: const TextStyle(
                color: Color(0xFF77827B),
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
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
                setState(() {
                  _query = value;
                });
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
                setState(() {
                  _availableOnly = value;
                });
              },
            ),

            const SizedBox(height: 10),

            if (snapshot.connectionState == ConnectionState.waiting)
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
                  child: _BookCard(
                    book: book,
                    selected: _isSelected(book),
                    onToggle: () {
                      widget.onToggleBook(book);
                      setState(() {});
                    },
                    onViewDetails: () {
                      _showBookDetails(book);
                    },
                  ),
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
  final bool selected;
  final VoidCallback onToggle;
  final VoidCallback onViewDetails;

  const _BookCard({
    required this.book,
    required this.selected,
    required this.onToggle,
    required this.onViewDetails,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(15),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(
          color: selected
              ? Theme.of(context).colorScheme.primary
              : const Color(0xFFE4E8E5),
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
                  style: const TextStyle(fontSize: 12),
                ),
                const SizedBox(height: 9),

                TextButton(
                  onPressed: onViewDetails,
                  style: TextButton.styleFrom(
                    padding: EdgeInsets.zero,
                    minimumSize: const Size(0, 30),
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  child: const Text('View Details'),
                ),

                const SizedBox(height: 4),

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
                      onPressed: book.isAvailable ? onToggle : null,
                      child: Text(
                        selected ? 'Selected' : 'Select',
                      ),
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
