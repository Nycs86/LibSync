
import 'dart:convert';

import 'package:flutter/foundation.dart';
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

    // DEBUG: Check kung may online book cover URL.
    if (kDebugMode) {
      debugPrint('BOOKS API RESPONSE: $decoded');

      if (decoded is List && decoded.isNotEmpty) {
        final firstBook = decoded.first;

        if (firstBook is Map) {
          debugPrint(
            'FIRST BOOK COVER URL: '
            '${firstBook['cover_image_url']}',
          );
        }
      }
    }

    if (decoded is! List) {
      throw Exception('Unexpected books response.');
    }

    return decoded
        .map(
          (item) => Book.fromJson(
            Map<String, dynamic>.from(item as Map),
          ),
        )
        .toList();
  }
}
