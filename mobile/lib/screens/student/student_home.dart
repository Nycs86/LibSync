
import 'package:flutter/material.dart';

import '../../models/book.dart';
import '../../services/book_service.dart';
import 'student_performance_card.dart';

class StudentHome extends StatefulWidget {
  const StudentHome({super.key});

  @override
  State<StudentHome> createState() => _StudentHomeState();
}

class _StudentHomeState extends State<StudentHome> {
  static const green = Color(0xFF006B50);
  static const darkGreen = Color(0xFF064E3B);
  static const cream = Color(0xFFFFF8E8);
  static const muted = Color(0xFF71877D);

  late Future<List<Book>> _booksFuture;
  int _performanceRefreshVersion = 0;

  final TextEditingController _searchController =
      TextEditingController();

  String _search = '';

  @override
  void initState() {
    super.initState();
    _booksFuture = BookService.getBooks();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _refresh() async {
    final future = BookService.getBooks();

    setState(() {
      _booksFuture = future;
      _performanceRefreshVersion += 1;
    });

    try {
      await future;
    } catch (_) {
      // FutureBuilder displays the error.
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      color: cream,
      child: RefreshIndicator(
        color: green,
        onRefresh: _refresh,
        child: FutureBuilder<List<Book>>(
          future: _booksFuture,
          builder: (context, snapshot) {
            final books = snapshot.data ?? <Book>[];

            final availableTitles =
                books.where((book) => book.isAvailable).length;

            final availableCopies = books.fold<int>(
              0,
              (sum, book) => sum + book.availableQuantity,
            );

            final query = _search.trim().toLowerCase();

            final filtered = books.where((book) {
              if (query.isEmpty) return true;

              return book.title.toLowerCase().contains(query) ||
                  book.author.toLowerCase().contains(query) ||
                  (book.category ?? '')
                      .toLowerCase()
                      .contains(query);
            }).toList();

            return ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(
                18, 20, 18, 32,
              ),
              children: [
                // Search
                TextField(
                  controller: _searchController,
                  onChanged: (value) {
                    setState(() => _search = value);
                  },
                  decoration: InputDecoration(
                    hintText:
                        'Search books by title, author, or category',
                    hintStyle: const TextStyle(
                      color: muted,
                      fontSize: 13,
                    ),
                    prefixIcon: const Icon(
                      Icons.search,
                      color: green,
                    ),
                    suffixIcon: _search.isNotEmpty
                        ? IconButton(
                            icon: const Icon(Icons.close),
                            onPressed: () {
                              _searchController.clear();
                              setState(() => _search = '');
                            },
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

                const SizedBox(height: 18),

                // Welcome banner
                Container(
                  padding: const EdgeInsets.all(22),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [
                        Color(0xFFFFFFFF),
                        Color(0xFFDDF6EA),
                      ],
                    ),
                    borderRadius:
                        BorderRadius.circular(18),
                    border: Border.all(
                      color: const Color(0xFFDCEAE6),
                    ),
                  ),
                  child: Row(
                    crossAxisAlignment:
                        CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: 5,
                        height: 116,
                        decoration: BoxDecoration(
                          color: const Color(0xFF0B9B71),
                          borderRadius:
                              BorderRadius.circular(8),
                        ),
                      ),
                      const SizedBox(width: 16),
                      const Expanded(
                        child: Column(
                          crossAxisAlignment:
                              CrossAxisAlignment.start,
                          children: [
                            Text(
                              'YOUR LIBRARY SPACE',
                              style: TextStyle(
                                color: green,
                                fontSize: 10,
                                fontWeight: FontWeight.w900,
                                letterSpacing: 1.6,
                              ),
                            ),
                            SizedBox(height: 12),
                            Text(
                              'What will you read today?',
                              style: TextStyle(
                                color: darkGreen,
                                fontSize: 25,
                                height: 1.15,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                            SizedBox(height: 10),
                            Text(
                              'Discover your next favorite book '
                              'from the library catalogue.',
                              style: TextStyle(
                                color: muted,
                                fontSize: 13,
                                height: 1.5,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 22),

                // Same Return Performance Score and Score History as student web.
                // A pull-to-refresh reloads this card together with the catalogue.
                StudentPerformanceCard(
                  key: ValueKey(_performanceRefreshVersion),
                ),

                const SizedBox(height: 22),

                if (snapshot.connectionState ==
                    ConnectionState.waiting)
                  const Padding(
                    padding: EdgeInsets.all(48),
                    child: Center(
                      child: CircularProgressIndicator(
                        color: green,
                      ),
                    ),
                  )
                else if (snapshot.hasError)
                  _errorCard()
                else ...[
                  // Statistics
                  Row(
                    children: [
                      Expanded(
                        child: _statCard(
                          icon: Icons.menu_book_outlined,
                          label: 'Books in catalogue',
                          value: '${books.length}',
                          iconColor: green,
                          iconBackground:
                              const Color(0xFFE4F6ED),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _statCard(
                          icon: Icons.bookmark_border,
                          label: 'Available titles',
                          value: '$availableTitles',
                          iconColor: green,
                          iconBackground:
                              const Color(0xFFF2F4D9),
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 12),

                  _statCard(
                    icon: Icons.library_books_outlined,
                    label: 'Available copies',
                    value: '$availableCopies',
                    iconColor: green,
                    iconBackground:
                        const Color(0xFFFFEBDD),
                  ),

                  const SizedBox(height: 30),

                  // All books heading
                  const Text(
                    'All Books',
                    style: TextStyle(
                      color: darkGreen,
                      fontSize: 25,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 5),
                  const Text(
                    'Explore the library collection.',
                    style: TextStyle(
                      color: muted,
                      fontSize: 13,
                    ),
                  ),

                  const SizedBox(height: 16),

                  if (filtered.isEmpty)
                    Container(
                      padding: const EdgeInsets.all(32),
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
                    ...filtered.map(_bookCard),
                ],
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _statCard({
    required IconData icon,
    required String label,
    required String value,
    required Color iconColor,
    required Color iconBackground,
  }) {
    return Container(
      padding: const EdgeInsets.all(15),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: const Color(0xFFE7E8E2),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 43,
            height: 43,
            decoration: BoxDecoration(
              color: iconBackground,
              borderRadius: BorderRadius.circular(13),
            ),
            child: Icon(
              icon,
              color: iconColor,
              size: 23,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            label,
            maxLines: 2,
            style: const TextStyle(
              color: muted,
              fontSize: 12,
            ),
          ),
          const SizedBox(height: 5),
          Text(
            value,
            style: const TextStyle(
              color: darkGreen,
              fontSize: 26,
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
    );
  }

  Widget _bookCard(Book book) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(15),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: const Color(0xFFE7E8E2),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 58,
            height: 76,
            decoration: BoxDecoration(
              color: const Color(0xFFE7F5EE),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(
              Icons.menu_book_rounded,
              color: green,
              size: 28,
            ),
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
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 5),
                Text(
                  book.author,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: muted,
                    fontSize: 13,
                  ),
                ),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 7,
                  runSpacing: 7,
                  children: [
                    _chip(book.category ?? 'General'),
                    _chip(
                      '${book.availableQuantity} available',
                      highlighted: book.isAvailable,
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
            ? const Color(0xFFE4F6ED)
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

  Widget _errorCard() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        children: [
          const Icon(
            Icons.cloud_off_outlined,
            size: 38,
            color: Colors.redAccent,
          ),
          const SizedBox(height: 12),
          const Text(
            'Unable to load books.',
            style: TextStyle(
              color: darkGreen,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _refresh,
            style: FilledButton.styleFrom(
              backgroundColor: green,
            ),
            child: const Text('Retry'),
          ),
        ],
      ),
    );
  }
}
