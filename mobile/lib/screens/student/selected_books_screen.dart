
import 'package:flutter/material.dart';

import '../../models/book.dart';
import '../../services/borrow_service.dart';

class SelectedBooksScreen extends StatefulWidget {
  final int userId;
  final List<Book> selectedBooks;
  final ValueChanged<Book> onRemoveBook;
  final VoidCallback onRequestSuccess;

  const SelectedBooksScreen({
    super.key,
    required this.userId,
    required this.selectedBooks,
    required this.onRemoveBook,
    required this.onRequestSuccess,
  });

  @override
  State<SelectedBooksScreen> createState() =>
      _SelectedBooksScreenState();
}

class _SelectedBooksScreenState
    extends State<SelectedBooksScreen> {
  static const Color green = Color(0xFF006B50);
  static const Color darkGreen = Color(0xFF064E3B);
  static const Color cream = Color(0xFFFFF8E8);
  static const Color mint = Color(0xFFDDF6EA);
  static const Color muted = Color(0xFF71877D);

  static const int loanDays = 1;

  final BorrowService _borrowService = BorrowService();

  bool _submitting = false;

  Future<void> _submitRequest() async {
    if (widget.selectedBooks.isEmpty || _submitting) {
      return;
    }

    setState(() {
      _submitting = true;
    });

    final bookIds = widget.selectedBooks
        .map((book) => book.id)
        .toList();

    try {
      final result =
          await _borrowService.submitBorrowRequest(
        userId: widget.userId,
        bookIds: bookIds,
        loanDays: loanDays,
      );

      if (!mounted) return;

      if (result['success'] == true) {
        widget.onRequestSuccess();

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              result['message'] ??
                  'Borrow request submitted. '
                      'Wait for librarian approval.',
            ),
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              result['message'] ??
                  'Unable to submit request.',
            ),
          ),
        );
      }
    } catch (_) {
      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Unable to connect to the server.',
          ),
        ),
      );
    } finally {
      if (mounted) {
        setState(() {
          _submitting = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final books = widget.selectedBooks;

    return Container(
      color: cream,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(
          18, 20, 18, 32,
        ),
        children: [
          const Text(
            'Selected Books',
            style: TextStyle(
              color: darkGreen,
              fontSize: 27,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            books.isEmpty
                ? 'Your selected books will appear here.'
                : '${books.length} book(s) selected.',
            style: const TextStyle(
              color: muted,
              fontSize: 13,
            ),
          ),
          const SizedBox(height: 24),

          if (books.isEmpty)
            Container(
              padding: const EdgeInsets.symmetric(
                vertical: 48,
                horizontal: 24,
              ),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius:
                    BorderRadius.circular(18),
                border: Border.all(
                  color: const Color(0xFFE7E8E2),
                ),
              ),
              child: const Column(
                children: [
                  CircleAvatar(
                    radius: 34,
                    backgroundColor: mint,
                    child: Icon(
                      Icons.shopping_bag_outlined,
                      color: green,
                      size: 34,
                    ),
                  ),
                  SizedBox(height: 18),
                  Text(
                    'No selected books yet',
                    style: TextStyle(
                      color: darkGreen,
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  SizedBox(height: 8),
                  Text(
                    'Visit the Books tab to choose '
                    'books you want to borrow.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: muted,
                      height: 1.5,
                    ),
                  ),
                ],
              ),
            )
          else ...[
            // Selected book cards
            ...books.map(
              (book) => Container(
                margin: const EdgeInsets.only(
                  bottom: 12,
                ),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius:
                      BorderRadius.circular(16),
                  border: Border.all(
                    color: const Color(0xFFE7E8E2),
                  ),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 54,
                      height: 66,
                      decoration: BoxDecoration(
                        color: mint,
                        borderRadius:
                            BorderRadius.circular(12),
                      ),
                      child: const Icon(
                        Icons.menu_book_rounded,
                        color: green,
                        size: 27,
                      ),
                    ),
                    const SizedBox(width: 13),
                    Expanded(
                      child: Column(
                        crossAxisAlignment:
                            CrossAxisAlignment.start,
                        children: [
                          Text(
                            book.title,
                            maxLines: 2,
                            overflow:
                                TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: darkGreen,
                              fontSize: 14,
                              fontWeight:
                                  FontWeight.w800,
                            ),
                          ),
                          const SizedBox(height: 5),
                          Text(
                            book.author,
                            maxLines: 1,
                            overflow:
                                TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: muted,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      tooltip: 'Remove book',
                      onPressed: _submitting
                          ? null
                          : () {
                              widget.onRemoveBook(book);
                            },
                      icon: const Icon(
                        Icons.close,
                        color: Color(0xFFB45454),
                      ),
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 14),

            // Fixed 24-hour borrowing period
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius:
                    BorderRadius.circular(17),
                border: Border.all(
                  color: const Color(0xFFD9EAE2),
                ),
              ),
              child: Row(
                crossAxisAlignment:
                    CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: mint,
                      borderRadius:
                          BorderRadius.circular(13),
                    ),
                    child: const Icon(
                      Icons.schedule,
                      color: green,
                      size: 26,
                    ),
                  ),
                  const SizedBox(width: 14),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment:
                          CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Borrowing Period',
                          style: TextStyle(
                            color: muted,
                            fontSize: 12,
                          ),
                        ),
                        SizedBox(height: 5),
                        Text(
                          '24 Hours',
                          style: TextStyle(
                            color: darkGreen,
                            fontSize: 22,
                            fontWeight:
                                FontWeight.w900,
                          ),
                        ),
                        SizedBox(height: 7),
                        Text(
                          'The 24-hour period starts '
                          'when the librarian scans '
                          'and confirms the receiving QR.',
                          style: TextStyle(
                            color: muted,
                            fontSize: 12,
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

            SizedBox(
              height: 54,
              child: FilledButton.icon(
                onPressed:
                    _submitting ? null : _submitRequest,
                style: FilledButton.styleFrom(
                  backgroundColor: green,
                  foregroundColor: Colors.white,
                  disabledBackgroundColor:
                      const Color(0xFF83B9A7),
                  shape: RoundedRectangleBorder(
                    borderRadius:
                        BorderRadius.circular(12),
                  ),
                ),
                icon: _submitting
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(
                        Icons.send_outlined,
                      ),
                label: Text(
                  _submitting
                      ? 'Submitting...'
                      : 'Submit Borrow Request',
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
