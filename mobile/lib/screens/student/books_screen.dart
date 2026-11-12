
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
  static const green = Color(0xFF006B50);
  static const darkGreen = Color(0xFF064E3B);
  static const cream = Color(0xFFFFF8E8);
  static const muted = Color(0xFF71877D);
  static const mint = Color(0xFFDDF6EA);

  late Future<List<Book>> _future;
  final _searchController = TextEditingController();

  String _query = '';
  bool _availableOnly = false;

  @override
  void initState() {
    super.initState();
    _future = BookService.getBooks();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _reload() async {
    final future = BookService.getBooks();

    setState(() {
      _future = future;
    });

    try {
      await future;
    } catch (_) {
      // The FutureBuilder handles the error state.
    }
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
      builder: (sheetContext) {
        return Container(
          constraints: BoxConstraints(
            maxHeight:
                MediaQuery.of(sheetContext).size.height * 0.85,
          ),
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(
              top: Radius.circular(26),
            ),
          ),
          child: SafeArea(
            top: false,
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment:
                    CrossAxisAlignment.start,
                children: [
                  Center(
                    child: Container(
                      width: 42,
                      height: 5,
                      decoration: BoxDecoration(
                        color: const Color(0xFFD9E5DE),
                        borderRadius:
                            BorderRadius.circular(20),
                      ),
                    ),
                  ),
                  const SizedBox(height: 22),

                  Center(
                    child: _BookCover(
                      coverUrl: book.coverImageUrl,
                      width: 104,
                      height: 146,
                      borderRadius: 16,
                      iconSize: 44,
                    ),
                  ),

                  const SizedBox(height: 20),

                  Text(
                    book.title,
                    style: const TextStyle(
                      color: darkGreen,
                      fontSize: 23,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 7),
                  Text(
                    'by ${book.author}',
                    style: const TextStyle(
                      color: muted,
                      fontSize: 14,
                    ),
                  ),

                  const SizedBox(height: 16),

                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      _chip(book.category ?? 'General'),
                      _chip(
                        book.isAvailable
                            ? '${book.availableQuantity} available'
                            : 'Unavailable',
                        highlighted: book.isAvailable,
                      ),
                    ],
                  ),

                  const SizedBox(height: 26),

                  const Text(
                    'About this book',
                    style: TextStyle(
                      color: darkGreen,
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    book.description?.trim().isNotEmpty ==
                            true
                        ? book.description!.trim()
                        : 'No description available for this book.',
                    style: const TextStyle(
                      color: Color(0xFF53665C),
                      height: 1.6,
                    ),
                  ),

                  const SizedBox(height: 22),
                  const Divider(
                    color: Color(0xFFE5EEE8),
                  ),
                  const SizedBox(height: 16),

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
                    height: 50,
                    child: FilledButton(
                      onPressed: () {
                        Navigator.pop(sheetContext);
                      },
                      style: FilledButton.styleFrom(
                        backgroundColor: green,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius:
                              BorderRadius.circular(12),
                        ),
                      ),
                      child: const Text('Close'),
                    ),
                  ),
                ],
              ),
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
      padding: const EdgeInsets.only(bottom: 13),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 125,
            child: Text(
              label,
              style: const TextStyle(
                color: muted,
                fontWeight: FontWeight.w600,
                fontSize: 13,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(
                color: darkGreen,
                fontWeight: FontWeight.w600,
                fontSize: 13,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _chip(
    String label, {
    bool highlighted = false,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: 10,
        vertical: 6,
      ),
      decoration: BoxDecoration(
        color: highlighted
            ? mint
            : const Color(0xFFF1F5F2),
        borderRadius: BorderRadius.circular(30),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: highlighted ? green : muted,
          fontSize: 11,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      color: cream,
      child: RefreshIndicator(
        color: green,
        onRefresh: _reload,
        child: FutureBuilder<List<Book>>(
          future: _future,
          builder: (context, snapshot) {
            final books = snapshot.data ?? const <Book>[];

            final filtered = books.where((book) {
              final term = _query.trim().toLowerCase();

              final matchesQuery = term.isEmpty ||
                  book.title.toLowerCase().contains(term) ||
                  book.author.toLowerCase().contains(term) ||
                  (book.isbn ?? '')
                      .toLowerCase()
                      .contains(term) ||
                  (book.category ?? '')
                      .toLowerCase()
                      .contains(term);

              final matchesAvailability =
                  !_availableOnly || book.isAvailable;

              return matchesQuery && matchesAvailability;
            }).toList();

            return ListView(
              physics:
                  const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(
                18, 20, 18, 32,
              ),
              children: [
                const Text(
                  'Library Catalogue',
                  style: TextStyle(
                    color: darkGreen,
                    fontSize: 27,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 5),
                const Text(
                  'Browse, explore, and select your next read.',
                  style: TextStyle(
                    color: muted,
                    fontSize: 13,
                  ),
                ),

                const SizedBox(height: 20),

                // Search
                TextField(
                  controller: _searchController,
                  onChanged: (value) {
                    setState(() => _query = value);
                  },
                  decoration: InputDecoration(
                    hintText:
                        'Search title, author, ISBN, or category',
                    hintStyle: const TextStyle(
                      color: muted,
                      fontSize: 13,
                    ),
                    prefixIcon: const Icon(
                      Icons.search,
                      color: green,
                    ),
                    suffixIcon: _query.isNotEmpty
                        ? IconButton(
                            onPressed: () {
                              _searchController.clear();
                              setState(() => _query = '');
                            },
                            icon: const Icon(Icons.close),
                          )
                        : null,
                    filled: true,
                    fillColor: Colors.white,
                    contentPadding:
                        const EdgeInsets.symmetric(
                      vertical: 17,
                      horizontal: 14,
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius:
                          BorderRadius.circular(14),
                      borderSide: const BorderSide(
                        color: Color(0xFFE3E9E5),
                      ),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius:
                          BorderRadius.circular(14),
                      borderSide: const BorderSide(
                        color: green,
                        width: 1.5,
                      ),
                    ),
                  ),
                ),

                const SizedBox(height: 14),

                // Availability filter
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius:
                        BorderRadius.circular(14),
                    border: Border.all(
                      color: const Color(0xFFE3E9E5),
                    ),
                  ),
                  child: SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    activeThumbColor: green,
                    title: const Text(
                      'Available books only',
                      style: TextStyle(
                        color: darkGreen,
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                      ),
                    ),
                    value: _availableOnly,
                    onChanged: (value) {
                      setState(() {
                        _availableOnly = value;
                      });
                    },
                  ),
                ),

                const SizedBox(height: 24),

                Row(
                  children: [
                    const Expanded(
                      child: Text(
                        'All Books',
                        style: TextStyle(
                          color: darkGreen,
                          fontSize: 23,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                    if (snapshot.hasData)
                      _chip('${filtered.length} titles'),
                  ],
                ),

                const SizedBox(height: 14),

                if (snapshot.connectionState ==
                    ConnectionState.waiting)
                  const Padding(
                    padding: EdgeInsets.only(top: 60),
                    child: Center(
                      child: CircularProgressIndicator(
                        color: green,
                      ),
                    ),
                  )
                else if (snapshot.hasError)
                  Container(
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius:
                          BorderRadius.circular(16),
                    ),
                    child: Column(
                      children: [
                        const Text(
                          'Unable to load books.',
                          style: TextStyle(
                            color: darkGreen,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 12),
                        FilledButton(
                          onPressed: _reload,
                          style: FilledButton.styleFrom(
                            backgroundColor: green,
                          ),
                          child: const Text('Retry'),
                        ),
                      ],
                    ),
                  )
                else if (filtered.isEmpty)
                  Container(
                    padding: const EdgeInsets.all(30),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius:
                          BorderRadius.circular(16),
                    ),
                    child: const Column(
                      children: [
                        Icon(
                          Icons.search_off,
                          size: 36,
                          color: muted,
                        ),
                        SizedBox(height: 10),
                        Text(
                          'No matching books found.',
                          style: TextStyle(color: muted),
                        ),
                      ],
                    ),
                  )
                else
                  ...filtered.map(
                    (book) => Padding(
                      padding: const EdgeInsets.only(
                        bottom: 12,
                      ),
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
        ),
      ),
    );
  }
}

class _BookCard extends StatelessWidget {
  static const green = Color(0xFF006B50);
  static const darkGreen = Color(0xFF064E3B);
  static const muted = Color(0xFF71877D);

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
        borderRadius: BorderRadius.circular(17),
        border: Border.all(
          color: selected
              ? green
              : const Color(0xFFE7E8E2),
          width: selected ? 1.5 : 1,
        ),
      ),
      child: Column(
        children: [
          Row(
            crossAxisAlignment:
                CrossAxisAlignment.start,
            children: [
              _BookCover(
                coverUrl: book.coverImageUrl,
                width: 65,
                height: 88,
                borderRadius: 12,
                iconSize: 30,
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment:
                      CrossAxisAlignment.start,
                  children: [
                    Text(
                      book.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: darkGreen,
                        fontWeight: FontWeight.w800,
                        fontSize: 15,
                      ),
                    ),
                    const SizedBox(height: 5),
                    Text(
                      book.author,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: muted,
                        fontSize: 12,
                      ),
                    ),
                    const SizedBox(height: 9),
                    Wrap(
                      spacing: 7,
                      runSpacing: 7,
                      children: [
                        _tag(
                          book.category ?? 'General',
                          false,
                        ),
                        _tag(
                          book.isAvailable
                              ? '${book.availableQuantity} available'
                              : 'Unavailable',
                          book.isAvailable,
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),

          const SizedBox(height: 14),

          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: onViewDetails,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: green,
                    side: const BorderSide(
                      color: Color(0xFFB9D9CC),
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius:
                          BorderRadius.circular(11),
                    ),
                  ),
                  child: const Text('View Details'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: FilledButton(
                  onPressed:
                      book.isAvailable ? onToggle : null,
                  style: FilledButton.styleFrom(
                    backgroundColor: selected
                        ? const Color(0xFFDDF6EA)
                        : green,
                    foregroundColor:
                        selected ? green : Colors.white,
                    disabledBackgroundColor:
                        const Color(0xFFE7EAE8),
                    shape: RoundedRectangleBorder(
                      borderRadius:
                          BorderRadius.circular(11),
                    ),
                  ),
                  child: Text(
                    selected ? 'Selected ✓' : 'Select Book',
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _tag(String label, bool available) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: 9,
        vertical: 5,
      ),
      decoration: BoxDecoration(
        color: available
            ? const Color(0xFFE4F6ED)
            : const Color(0xFFF1F5F2),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: available ? green : muted,
          fontSize: 10,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}


/// Displays the backend-provided cover URL, with a safe icon fallback.
class _BookCover extends StatelessWidget {
  final String? coverUrl;
  final double width;
  final double height;
  final double borderRadius;
  final double iconSize;

  const _BookCover({
    required this.coverUrl,
    required this.width,
    required this.height,
    required this.borderRadius,
    required this.iconSize,
  });

  @override
  Widget build(BuildContext context) {
    final url = coverUrl?.trim();
    final uri = url == null ? null : Uri.tryParse(url);
    final validUrl = uri != null &&
        (uri.scheme == 'https' || uri.scheme == 'http') &&
        uri.host.isNotEmpty;

    final fallback = Center(
      child: Icon(
        Icons.menu_book_rounded,
        color: const Color(0xFF006B50),
        size: iconSize,
      ),
    );

    return Container(
      width: width,
      height: height,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: const Color(0xFFE4F6ED),
        borderRadius: BorderRadius.circular(borderRadius),
      ),
      child: validUrl && url != null
          ? Image.network(
              url,
              fit: BoxFit.cover,
              width: width,
              height: height,
              errorBuilder: (context, error, stackTrace) => fallback,
            )
          : fallback,
    );
  }
}
