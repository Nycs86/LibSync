import 'package:flutter/material.dart';

import '../../models/book.dart';
import '../../services/borrow_service.dart';

class SelectedBooksScreen
    extends StatefulWidget {
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
  final BorrowService _borrowService =
      BorrowService();

  int _loanDays = 1;
  bool _submitting = false;

  Future<void> _submitRequest() async {
    if (widget.selectedBooks.isEmpty) {
      return;
    }

    setState(() {
      _submitting = true;
    });

    final bookIds = widget.selectedBooks
        .map((book) => book.id)
        .toList();

    final result =
        await _borrowService.submitBorrowRequest(
      userId: widget.userId,
      bookIds: bookIds,
      loanDays: _loanDays,
    );

    if (!mounted) {
      return;
    }

    setState(() {
      _submitting = false;
    });

    if (result['success'] == true) {
      widget.onRequestSuccess();

      ScaffoldMessenger.of(context)
          .showSnackBar(
        SnackBar(
          content: Text(
            result['message'] ??
                'Borrow request submitted.',
          ),
        ),
      );
    } else {
      ScaffoldMessenger.of(context)
          .showSnackBar(
        SnackBar(
          content: Text(
            result['message'] ??
                'Unable to submit request.',
          ),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final books = widget.selectedBooks;

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
        Text(
          books.isEmpty
              ? 'Your selected books will appear here.'
              : '${books.length} book(s) selected.',
          style: const TextStyle(
            color: Color(0xFF77827B),
          ),
        ),
        const SizedBox(height: 24),

        if (books.isEmpty) ...[
          const SizedBox(height: 45),
          Icon(
            Icons.shopping_bag_outlined,
            size: 64,
            color: Theme.of(context)
                .colorScheme
                .primary,
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
        ] else ...[
          ...books.map(
            (book) => Card(
              margin:
                  const EdgeInsets.only(
                bottom: 10,
              ),
              child: ListTile(
                leading: const Icon(
                  Icons.menu_book,
                ),
                title: Text(
                  book.title,
                ),
                subtitle: Text(
                  book.author,
                ),
                trailing: IconButton(
                  icon: const Icon(
                    Icons.close,
                  ),
                  onPressed: () {
                    widget.onRemoveBook(
                      book,
                    );
                  },
                ),
              ),
            ),
          ),

          const SizedBox(height: 18),

          DropdownButtonFormField<int>(
            initialValue: _loanDays,
            decoration:
                const InputDecoration(
              labelText: 'Borrow period',
              border:
                  OutlineInputBorder(),
            ),
            items: List.generate(
              5,
              (index) {
                final days = index + 1;

                return DropdownMenuItem(
                  value: days,
                  child: Text(
                    '$days day${days > 1 ? 's' : ''}',
                  ),
                );
              },
            ),
            onChanged: _submitting
                ? null
                : (value) {
                    if (value != null) {
                      setState(() {
                        _loanDays = value;
                      });
                    }
                  },
          ),

          const SizedBox(height: 18),

          SizedBox(
            height: 52,
            child: FilledButton.icon(
              onPressed: _submitting
                  ? null
                  : _submitRequest,
              icon: _submitting
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child:
                          CircularProgressIndicator(
                        strokeWidth: 2,
                      ),
                    )
                  : const Icon(
                      Icons.send,
                    ),
              label: Text(
                _submitting
                    ? 'Submitting...'
                    : 'Request Borrow',
              ),
            ),
          ),
        ],
      ],
    );
  }
}