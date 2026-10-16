import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/api_config.dart';

class AuthService {
  Future<Map<String, dynamic>> loginStudent({
    required String email,
    required String password,
  }) async {
    final response = await http.post(
      Uri.parse('${ApiConfig.baseUrl}/api/login'),
      headers: {
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'email': email,
        'password': password,
        'role': 'student',
      }),
    );

    Map<String, dynamic> data = {};

    try {
      data = jsonDecode(response.body) as Map<String, dynamic>;
    } catch (_) {
      return {
        'success': false,
        'message': 'Invalid response from server.',
      };
    }

    if (response.statusCode >= 200 && response.statusCode < 300) {
      final user = data['user'];

      if (user == null) {
        return {
          'success': false,
          'message': 'User information was not returned.',
        };
      }

      if ((user['role'] ?? '').toString().toLowerCase() != 'student') {
        return {
          'success': false,
          'message': 'This account is not registered as a student.',
        };
      }

      return {
        'success': true,
        'user': user,
      };
    }

    return {
      'success': false,
      'message': data['message'] ?? 'Invalid email or password.',
    };
  }
}