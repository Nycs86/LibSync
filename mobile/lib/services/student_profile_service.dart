import 'dart:convert';

import 'package:http/http.dart' as http;

import '../config/api_config.dart';
import 'auth_session.dart';

class StudentProfileService {
  Map<String, dynamic> _decodeObject(http.Response response) {
    try {
      final decoded = jsonDecode(response.body);
      if (decoded is Map<String, dynamic>) {
        return decoded;
      }
    } catch (_) {}

    return <String, dynamic>{};
  }

  Future<Map<String, dynamic>> getStudentProfile({
    required int userId,
  }) async {
    if (!AuthSession.isAuthenticated) {
      return {
        'success': false,
        'sessionExpired': true,
        'message': 'Your session has expired. Please log in again.',
      };
    }

    try {
      final response = await http.get(
        Uri.parse(
          '${ApiConfig.baseUrl}/api/student/profile/$userId',
        ),
        headers: AuthSession.authorizationHeaders,
      );

      final data = _decodeObject(response);

      if (response.statusCode >= 200 &&
          response.statusCode < 300) {
        final user = data['user'];

        if (user is! Map<String, dynamic>) {
          return {
            'success': false,
            'message': 'The server returned an invalid student profile.',
          };
        }

        return {
          'success': true,
          'profile': user,
        };
      }

      if (response.statusCode == 401) {
        AuthSession.clear();

        return {
          'success': false,
          'sessionExpired': true,
          'message': 'Your session has expired. Please log in again.',
        };
      }

      return {
        'success': false,
        'message':
            data['message'] ??
            'Unable to load student profile.',
      };
    } catch (_) {
      return {
        'success': false,
        'message': 'Unable to connect to the server.',
      };
    }
  }

  Future<Map<String, dynamic>> updateStudentProfile({
    required int userId,
    required String name,
    required String studentNumber,
    required String program,
    required String college,
    required String yearLevel,
    required String gender,
  }) async {
    if (!AuthSession.isAuthenticated) {
      return {
        'success': false,
        'sessionExpired': true,
        'message': 'Your session has expired. Please log in again.',
      };
    }

    try {
      final response = await http.put(
        Uri.parse(
          '${ApiConfig.baseUrl}/api/student/profile/$userId',
        ),
        headers: {
          ...AuthSession.authorizationHeaders,
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'name': name.trim(),
          'student_number': studentNumber.trim(),
          'program': program.trim(),
          'college': college.trim(),
          'year_level': yearLevel.trim().isEmpty
              ? null
              : int.tryParse(yearLevel.trim()),
          'gender': gender.trim(),
        }),
      );

      final data = _decodeObject(response);

      if (response.statusCode >= 200 &&
          response.statusCode < 300) {
        return {
          'success': true,
          'message':
              data['message'] ??
              'Profile updated successfully.',
        };
      }

      if (response.statusCode == 401) {
        AuthSession.clear();

        return {
          'success': false,
          'sessionExpired': true,
          'message': 'Your session has expired. Please log in again.',
        };
      }

      return {
        'success': false,
        'message':
            data['message'] ??
            'Unable to update student profile.',
      };
    } catch (_) {
      return {
        'success': false,
        'message': 'Unable to connect to the server.',
      };
    }
  }
}
