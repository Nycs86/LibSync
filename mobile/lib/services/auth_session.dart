class AuthSession {
  AuthSession._();

  static String? _accessToken;
  static Map<String, dynamic>? _user;

  static String? get accessToken => _accessToken;

  static Map<String, dynamic>? get user {
    final currentUser = _user;
    if (currentUser == null) {
      return null;
    }
    return Map<String, dynamic>.unmodifiable(currentUser);
  }

  static bool get isAuthenticated =>
      _accessToken != null &&
      _accessToken!.trim().isNotEmpty &&
      _user != null;

  static Map<String, String> get authorizationHeaders {
    final token = _accessToken;

    if (token == null || token.trim().isEmpty) {
      return const {};
    }

    return {
      'Authorization': 'Bearer $token',
      'Accept': 'application/json',
    };
  }

  static void setSession({
    required String accessToken,
    required Map<String, dynamic> user,
  }) {
    final token = accessToken.trim();

    if (token.isEmpty) {
      throw ArgumentError('Access token cannot be empty.');
    }

    _accessToken = token;
    _user = Map<String, dynamic>.from(user);
  }

  static void clear() {
    _accessToken = null;
    _user = null;
  }
}
