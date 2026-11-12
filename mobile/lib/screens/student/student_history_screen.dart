import 'package:flutter/material.dart';

import '../../services/borrow_service.dart';

class StudentHistoryScreen extends StatefulWidget {
  final int userId;
  final int refreshVersion;

  const StudentHistoryScreen({
    super.key,
    required this.userId,
    this.refreshVersion = 0,
  });

  @override
  State<StudentHistoryScreen> createState() => _StudentHistoryScreenState();
}

class _StudentHistoryScreenState extends State<StudentHistoryScreen> {
  final BorrowService _borrowService = BorrowService();

  bool _loading = true;
  String _error = '';
  String _filter = 'All';
  List<Map<String, dynamic>> _batches = [];

  static const Color green = Color(0xFF006B50);

  String _formatDate(dynamic value) {
    if (value == null || value.toString().isEmpty) {
      return 'Not available';
    }

    try {
      final date = DateTime.parse(value.toString());
      const months = [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December',
      ];
      return '${months[date.month - 1]} ${date.day}, ${date.year}';
    } catch (_) {
      return value.toString();
    }
  }

  @override
  void initState() {
    super.initState();
    _loadHistory();
  }

  @override
  void didUpdateWidget(covariant StudentHistoryScreen oldWidget) {
    super.didUpdateWidget(oldWidget);

    if (oldWidget.userId != widget.userId ||
        oldWidget.refreshVersion != widget.refreshVersion) {
      _loadHistory();
    }
  }

  Future<void> _loadHistory() async {
    setState(() {
      _loading = true;
      _error = '';
    });

    final result = await _borrowService.getStudentBorrowBatches(
      userId: widget.userId,
    );

    if (!mounted) return;

    if (result['success'] == true) {
      setState(() {
        _batches = (result['batches'] as List<dynamic>? ?? [])
            .whereType<Map<String, dynamic>>()
            .toList();
        _loading = false;
      });
    } else {
      setState(() {
        _loading = false;
        _error =
            result['message']?.toString() ??
            'Unable to load borrowing history.';
      });
    }
  }

  String _status(Map<String, dynamic> batch) {
    final status = (batch['status'] ?? '').toString().toLowerCase();

    if (status == 'returned') return 'Returned';
    if (status == 'declined') return 'Declined';
    if (status == 'pending') return 'Pending';

    final released = batch['borrow_qr_used_at'] != null;

    if (released) {
      final due = DateTime.tryParse(batch['due_date']?.toString() ?? '');

      if (due != null && DateTime.now().toUtc().isAfter(due.toUtc())) {
        return 'Overdue';
      }

      if (status == 'partially_returned') {
        return 'Partially Returned';
      }

      return 'Borrowed';
    }

    return 'Approved';
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'Borrowed':
      case 'Approved':
        return green;
      case 'Returned':
        return const Color(0xFF2E7D32);
      case 'Overdue':
      case 'Declined':
        return const Color(0xFFB3261E);
      case 'Partially Returned':
        return const Color(0xFF9A6700);
      default:
        return const Color(0xFF71877D);
    }
  }

  @override
  Widget build(BuildContext context) {
    final filters = [
      'All',
      'Pending',
      'Approved',
      'Borrowed',
      'Overdue',
      'Partially Returned',
      'Returned',
      'Declined',
    ];

    final visible = _batches.where((batch) {
      return _filter == 'All' || _status(batch) == _filter;
    }).toList();

    return RefreshIndicator(
      onRefresh: _loadHistory,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(18),
        children: [
          const Text(
            'Borrowing History',
            style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 5),
          const Text(
            'View your borrowing and return transactions.',
            style: TextStyle(color: Color(0xFF77827B)),
          ),
          const SizedBox(height: 18),

          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: filters.map((filter) {
                final selected = _filter == filter;

                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: Text(filter),
                    selected: selected,
                    selectedColor: const Color(0xFFDDF6EA),
                    onSelected: (_) {
                      setState(() => _filter = filter);
                    },
                  ),
                );
              }).toList(),
            ),
          ),

          const SizedBox(height: 18),

          if (_loading)
            const Padding(
              padding: EdgeInsets.only(top: 80),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (_error.isNotEmpty)
            Center(
              child: Column(
                children: [
                  Text(_error),
                  const SizedBox(height: 12),
                  OutlinedButton(
                    onPressed: _loadHistory,
                    child: const Text('Try Again'),
                  ),
                ],
              ),
            )
          else if (visible.isEmpty)
            const Padding(
              padding: EdgeInsets.only(top: 70),
              child: Center(child: Text('No borrowing records found.')),
            )
          else
            ...visible.map((batch) {
              final status = _status(batch);
              final books = batch['books'] is List
                  ? batch['books'] as List
                  : <dynamic>[];

              return Card(
                color: Colors.white,
                elevation: 0,
                margin: const EdgeInsets.only(bottom: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(18),
                  side: const BorderSide(color: Color(0xFFE4E8E5)),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(17),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              'Batch #${batch['id']}',
                              style: const TextStyle(
                                fontSize: 17,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 6,
                            ),
                            decoration: BoxDecoration(
                              color: _statusColor(
                                status,
                              ).withValues(alpha: 0.10),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Text(
                              status,
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                color: _statusColor(status),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),

                      ...books.map((rawBook) {
                        final book = rawBook is Map
                            ? Map<String, dynamic>.from(rawBook)
                            : <String, dynamic>{};

                        return Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Icon(
                                Icons.menu_book_outlined,
                                size: 19,
                                color: green,
                              ),
                              const SizedBox(width: 9),
                              Expanded(
                                child: Text(
                                  book['title']?.toString() ?? 'Untitled Book',
                                ),
                              ),
                            ],
                          ),
                        );
                      }),

                      const Divider(height: 22),

                      if (batch['created_at'] != null)
                        Text('Requested: ${_formatDate(batch['created_at'])}'),
                      if (batch['borrow_qr_used_at'] != null)
                        Text(
                          'Released: ${_formatDate(batch['borrow_qr_used_at'])}',
                        ),
                      if (batch['due_date'] != null)
                        Text('Due: ${_formatDate(batch['due_date'])}'),
                      if (batch['return_qr_used_at'] != null)
                        Text(
                          'Returned: ${_formatDate(batch['return_qr_used_at'])}',
                        ),
                    ],
                  ),
                ),
              );
            }),
        ],
      ),
    );
  }
}
