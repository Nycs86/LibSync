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
      final accessToken = data['access_token'];

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

      if (accessToken is! String || accessToken.trim().isEmpty) {
        return {
          'success': false,
          'message': 'Login succeeded, but no access token was returned.',
        };
      }

      return {
        'success': true,
        'user': user,
        'accessToken': accessToken,
        'tokenType': data['token_type'] ?? 'Bearer',
        'expiresIn': data['expires_in'],
      };
    }

    return {
      'success': false,
      'message': data['message'] ?? 'Invalid email or password.',
    };
  }
}
