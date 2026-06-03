class TokenStorage {
  String? _cachedToken;
  String? get cachedToken => _cachedToken;

  Future<String?> read() async {
    return _cachedToken;
  }

  Future<void> save(String token) async {
    _cachedToken = token;
  }

  Future<void> delete() async {
    _cachedToken = null;
  }
}
