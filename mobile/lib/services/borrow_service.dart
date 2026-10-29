import 'dart:convert';

import 'package:http/http.dart' as http;

import '../config/api_config.dart';

class BorrowService {
  Map<String, dynamic> _decodeObject(http.Response response) {
    try {
      final decoded = jsonDecode(response.body);
      if (decoded is Map<String, dynamic>) {
        return decoded;
      }
    } catch (_) {}
    return <String, dynamic>{};
  }

  Future<Map<String, dynamic>> submitBorrowRequest({
    required int userId,
    required List<int> bookIds,
    required int loanDays,
  }) async {
    try {
      final response = await http.post(
        Uri.parse('${ApiConfig.baseUrl}/api/borrow-requests'),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: jsonEncode({
          'user_id': userId,
          'book_ids': bookIds,
          'loan_days': loanDays,
        }),
      );

      final data = _decodeObject(response);

      if (response.statusCode >= 200 && response.statusCode < 300) {
        return {
          'success': true,
          'data': data,
          'message':
              data['message'] ?? 'Borrow request submitted successfully.',
        };
      }

      return {
        'success': false,
        'message':
            data['message'] ?? 'Unable to submit borrow request.',
      };
    } catch (_) {
      return {
        'success': false,
        'message': 'Unable to connect to the server.',
      };
    }
  }

  Future<Map<String, dynamic>> getStudentBorrowBatches({
    required int userId,
  }) async {
    try {
      final response = await http.get(
        Uri.parse(
          '${ApiConfig.baseUrl}/api/student/borrow-batches/$userId',
        ),
        headers: {
          'Accept': 'application/json',
          'X-User-ID': userId.toString(),
        },
      );

      final data = _decodeObject(response);

      if (response.statusCode >= 200 && response.statusCode < 300) {
        final rawBatches = data['batches'];
        final batches = rawBatches is List
            ? rawBatches
                .whereType<Map>()
                .map((item) => Map<String, dynamic>.from(item))
                .toList()
            : <Map<String, dynamic>>[];

        return {
          'success': true,
          'batches': batches,
        };
      }

      return {
        'success': false,
        'message':
            data['message'] ?? 'Unable to load borrowing status.',
      };
    } catch (_) {
      return {
        'success': false,
        'message': 'Unable to connect to the server.',
      };
    }
  }

  Future<Map<String, dynamic>> getBatchQr({
    required int userId,
    required int batchId,
  }) async {
    try {
      final response = await http.get(
        Uri.parse(
          '${ApiConfig.baseUrl}/api/borrow-batches/$batchId/qr',
        ),
        headers: {
          'Accept': 'application/json',
          'X-User-ID': userId.toString(),
        },
      );

      final data = _decodeObject(response);

      if (response.statusCode >= 200 && response.statusCode < 300) {
        return {
          'success': true,
          'qrType': data['qr_type'],
          'qrToken': data['qr_token'],
          'qrCode': data['qr_code'],
          'batch': data['batch'],
          'books': data['books'],
        };
      }

      return {
        'success': false,
        'message':
            data['message'] ?? 'QR code is not available yet.',
      };
    } catch (_) {
      return {
        'success': false,
        'message': 'Unable to connect to the server.',
      };
    }
  }
}
