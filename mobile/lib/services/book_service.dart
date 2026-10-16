import 'dart:convert';

import 'package:http/http.dart' as http;

import '../config/api_config.dart';
import '../models/book.dart';

class BookService {
  static Future<List<Book>> getBooks() async {
    final uri = Uri.parse('${ApiConfig.baseUrl}/api/books');

    final response = await http
        .get(uri)
        .timeout(const Duration(seconds: 90));

    if (response.statusCode != 200) {
      throw Exception(
        'Unable to load books (${response.statusCode}).',
      );
    }

    final decoded = jsonDecode(response.body);

    if (decoded is! List) {
      throw Exception('Unexpected books response.');
    }

    return decoded
        .map((item) => Book.fromJson(
              Map<String, dynamic>.from(item as Map),
            ))
        .toList();
  }
}
