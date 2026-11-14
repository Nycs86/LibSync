import 'dart:convert';

import 'package:http/http.dart' as http;

import '../config/api_config.dart';
import 'auth_session.dart';

/// Fetches the same student-only performance payload used by LibSync web.
class StudentPerformanceService {
  Future<Map<String, dynamic>> getMyPerformance() async {
    if (!AuthSession.isAuthenticated) {
      throw Exception('Your session has expired. Please log in again.');
    }

    try {
      final response = await http.get(
        Uri.parse('${ApiConfig.baseUrl}/api/student/return-performance'),
        headers: AuthSession.authorizationHeaders,
      ).timeout(const Duration(seconds: 25));
      final decoded = jsonDecode(response.body);
      if (decoded is! Map<String, dynamic>) {
        throw const FormatException('Unexpected server response.');
      }
      if (response.statusCode < 200 || response.statusCode >= 300 ||
          decoded['status'] != 'success') {
        throw Exception(decoded['message']?.toString() ??
            'Unable to load return performance.');
      }
      if (decoded['performance'] is! Map || decoded['history'] is! List) {
        throw const FormatException('Performance data is incomplete.');
      }
      return decoded;
    } on FormatException {
      throw Exception('The server returned invalid performance data.');
    } on http.ClientException {
      throw Exception('Unable to connect to the LibSync server.');
    }
  }
}
