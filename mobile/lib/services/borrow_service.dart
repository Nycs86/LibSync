import 'dart:convert';
import 'package:http/http.dart' as http;

import '../config/api_config.dart';

class BorrowService {
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
        },
        body: jsonEncode({
          'user_id': userId,
          'book_ids': bookIds,
          'loan_days': loanDays,
        }),
      );

      final Map<String, dynamic> data =
          jsonDecode(response.body) as Map<String, dynamic>;

      if (response.statusCode >= 200 &&
          response.statusCode < 300) {
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
    } catch (e) {
      return {
        'success': false,
        'message': 'Unable to connect to the server.',
      };
    }
  }
}