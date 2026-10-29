import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';

import '../../services/borrow_service.dart';

class StudentQrScreen extends StatefulWidget {
  final int userId;
  final int refreshVersion;

  const StudentQrScreen({
    super.key,
    required this.userId,
    this.refreshVersion = 0,
  });

  @override
  State<StudentQrScreen> createState() => _StudentQrScreenState();
}

class _StudentQrScreenState extends State<StudentQrScreen> {
  final BorrowService _borrowService = BorrowService();

  bool _loading = true;
  String _error = '';
  Map<String, dynamic>? _batch;
  String? _qrType;
  String? _qrCode;

  @override
  void initState() {
    super.initState();
    _loadBorrowingStatus();
  }

  @override
  void didUpdateWidget(covariant StudentQrScreen oldWidget) {
    super.didUpdateWidget(oldWidget);

    if (oldWidget.refreshVersion != widget.refreshVersion ||
        oldWidget.userId != widget.userId) {
      _loadBorrowingStatus();
    }
  }

  Future<void> _loadBorrowingStatus() async {
    if (!mounted) return;

    setState(() {
      _loading = true;
      _error = '';
    });

    final result = await _borrowService.getStudentBorrowBatches(
      userId: widget.userId,
    );

    if (!mounted) return;

    if (result['success'] != true) {
      setState(() {
        _loading = false;
        _error =
            result['message']?.toString() ?? 'Unable to load borrowing status.';
      });
      return;
    }

    final batches = (result['batches'] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .toList();

    Map<String, dynamic>? selectedBatch;

    for (final batch in batches) {
      final status = (batch['status'] ?? '').toString().toLowerCase();

      if (status == 'pending' ||
          status == 'approved' ||
          status == 'partially_returned') {
        selectedBatch = batch;
        break;
      }
    }

    selectedBatch ??= batches.isNotEmpty ? batches.first : null;

    if (selectedBatch == null) {
      setState(() {
        _loading = false;
        _batch = null;
        _qrType = null;
        _qrCode = null;
      });
      return;
    }

    String? qrType;
    String? qrCode;

    final qrAvailable = selectedBatch['qr_available'] == true;
    final batchId = _asInt(selectedBatch['id']);

    if (qrAvailable && batchId != null) {
      final qrResult = await _borrowService.getBatchQr(
        userId: widget.userId,
        batchId: batchId,
      );

      if (!mounted) return;

      if (qrResult['success'] == true) {
        qrType = qrResult['qrType']?.toString();
        qrCode = qrResult['qrCode']?.toString();
      }
    }

    if (!mounted) return;

    setState(() {
      _loading = false;
      _batch = selectedBatch;
      _qrType = qrType;
      _qrCode = qrCode;
    });
  }

  int? _asInt(dynamic value) {
    if (value is int) return value;
    return int.tryParse(value?.toString() ?? '');
  }

  Uint8List? _decodeQrImage(String? dataUrl) {
    if (dataUrl == null || dataUrl.isEmpty) {
      return null;
    }

    try {
      final encoded = dataUrl.contains(',')
          ? dataUrl.split(',').last
          : dataUrl;
      return base64Decode(encoded);
    } catch (_) {
      return null;
    }
  }

  String _statusLabel(Map<String, dynamic> batch) {
    final status = (batch['status'] ?? '').toString().toLowerCase();
    final borrowUsed = batch['borrow_qr_used_at'] != null;

    if (status == 'returned') return 'Returned';
    if (status == 'partially_returned') return 'Partially returned';
    if (status == 'approved' && borrowUsed) return 'Books released';
    if (status == 'approved') return 'Approved';
    if (status == 'declined') return 'Declined';

    return 'Pending librarian approval';
  }

  String _messageForState(Map<String, dynamic> batch) {
    final status = (batch['status'] ?? '').toString().toLowerCase();
    final borrowUsed = batch['borrow_qr_used_at'] != null;

    if (status == 'pending') {
      return 'Your request is pending. The Borrow QR will appear after librarian approval.';
    }

    if (status == 'declined') {
      return 'This borrowing request was declined. No QR is available.';
    }

    if (status == 'returned') {
      return 'All approved books in this batch have been returned.';
    }

    if (status == 'approved' && !borrowUsed) {
      return 'Your Borrow QR is ready. Show it to the librarian to release your books.';
    }

    if ((status == 'approved' && borrowUsed) ||
        status == 'partially_returned') {
      return 'Your Return QR is ready. Show it to the librarian when returning books.';
    }

    return 'No active QR is available for this borrowing batch.';
  }

  Color _statusColor(String status) {
    switch (status.toLowerCase()) {
      case 'approved':
      case 'books released':
        return const Color(0xFF0B6B57);
      case 'returned':
        return const Color(0xFF2E7D32);
      case 'partially returned':
        return const Color(0xFF9A6700);
      case 'declined':
        return const Color(0xFFB3261E);
      default:
        return const Color(0xFF6B746F);
    }
  }

  @override
  Widget build(BuildContext context) {
    final batch = _batch;
    final qrBytes = _decodeQrImage(_qrCode);

    return RefreshIndicator(
      onRefresh: _loadBorrowingStatus,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(18),
        children: [
          const Text(
            'Borrowing QR',
            style: TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 5),
          const Text(
            'Borrow QR appears after approval. After checkout, it changes to a Return QR.',
            style: TextStyle(
              color: Color(0xFF77827B),
            ),
          ),
          const SizedBox(height: 24),

          if (_loading)
            const Padding(
              padding: EdgeInsets.only(top: 80),
              child: Center(
                child: CircularProgressIndicator(),
              ),
            )
          else if (_error.isNotEmpty)
            _MessageCard(
              icon: Icons.error_outline,
              title: 'Unable to load QR status',
              message: _error,
              actionLabel: 'Try Again',
              onAction: _loadBorrowingStatus,
            )
          else if (batch == null)
            _MessageCard(
              icon: Icons.qr_code_2_rounded,
              title: 'No borrowing request yet',
              message:
                  'Submit a borrow request first. Your active QR will appear here when it becomes available.',
              actionLabel: 'Refresh',
              onAction: _loadBorrowingStatus,
            )
          else ...[
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: const Color(0xFFE4E8E5),
                ),
              ),
              child: Column(
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          _qrType == 'return'
                              ? 'Return QR'
                              : 'Borrow QR',
                          style: const TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                      Builder(
                        builder: (context) {
                          final label = _statusLabel(batch);
                          return Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 11,
                              vertical: 6,
                            ),
                            decoration: BoxDecoration(
                              color: _statusColor(label).withValues(alpha: 0.10),
                              borderRadius: BorderRadius.circular(999),
                            ),
                            child: Text(
                              label,
                              style: TextStyle(
                                color: _statusColor(label),
                                fontWeight: FontWeight.w700,
                                fontSize: 12,
                              ),
                            ),
                          );
                        },
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      'Batch ID: ${batch['id']}',
                      style: const TextStyle(
                        color: Color(0xFF77827B),
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),

                  if (qrBytes != null &&
                      (_qrType == 'borrow' || _qrType == 'return'))
                    Container(
                      padding: const EdgeInsets.all(14),
                      color: Colors.white,
                      child: Image.memory(
                        qrBytes,
                        width: 230,
                        height: 230,
                        fit: BoxFit.contain,
                        gaplessPlayback: true,
                      ),
                    )
                  else
                    const Icon(
                      Icons.qr_code_2_rounded,
                      size: 130,
                      color: Color(0xFFB7C0BB),
                    ),

                  const SizedBox(height: 18),

                  Text(
                    _messageForState(batch),
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: Color(0xFF55615B),
                      height: 1.4,
                    ),
                  ),

                  if (batch['due_date'] != null) ...[
                    const SizedBox(height: 18),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(
                          Icons.event_available_outlined,
                          size: 18,
                        ),
                        const SizedBox(width: 7),
                        Text(
                          'Due date: ${batch['due_date']}',
                          style: const TextStyle(
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ],

                  const SizedBox(height: 20),

                  OutlinedButton.icon(
                    onPressed: _loadBorrowingStatus,
                    icon: const Icon(Icons.refresh),
                    label: const Text('Refresh Status'),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 18),

            if (batch['books'] is List &&
                (batch['books'] as List).isNotEmpty)
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(
                    color: const Color(0xFFE4E8E5),
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Books in this request',
                      style: TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 17,
                      ),
                    ),
                    const SizedBox(height: 10),
                    ...(batch['books'] as List).map((rawBook) {
                      final book = rawBook is Map
                          ? Map<String, dynamic>.from(rawBook)
                          : <String, dynamic>{};
                      final status =
                          (book['status'] ?? '').toString().toLowerCase();

                      return ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: Icon(
                          status == 'returned'
                              ? Icons.check_circle
                              : status == 'declined'
                                  ? Icons.cancel_outlined
                                  : Icons.menu_book,
                          color: status == 'returned'
                              ? const Color(0xFF2E7D32)
                              : null,
                        ),
                        title: Text(
                          book['title']?.toString() ?? 'Untitled Book',
                        ),
                        subtitle: Text(
                          status.isEmpty
                              ? 'Status unavailable'
                              : status.replaceAll('_', ' '),
                        ),
                      );
                    }),
                  ],
                ),
              ),
          ],
        ],
      ),
    );
  }
}

class _MessageCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String message;
  final String actionLabel;
  final VoidCallback onAction;

  const _MessageCard({
    required this.icon,
    required this.title,
    required this.message,
    required this.actionLabel,
    required this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(28),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: const Color(0xFFE4E8E5),
        ),
      ),
      child: Column(
        children: [
          Icon(
            icon,
            size: 82,
            color: const Color(0xFF0B6B57),
          ),
          const SizedBox(height: 18),
          Text(
            title,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontWeight: FontWeight.w800,
              fontSize: 18,
            ),
          ),
          const SizedBox(height: 7),
          Text(
            message,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: Color(0xFF77827B),
              height: 1.4,
            ),
          ),
          const SizedBox(height: 18),
          OutlinedButton.icon(
            onPressed: onAction,
            icon: const Icon(Icons.refresh),
            label: Text(actionLabel),
          ),
        ],
      ),
    );
  }
}
