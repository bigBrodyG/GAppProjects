import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/auth_api.dart';
import '../api/client.dart';
import 'token_storage.dart';

export '../api/auth_api.dart' show AuthUser;

class AuthNotifier extends ChangeNotifier {
  final AuthApi _api;
  final TokenStorage _storage;

  AsyncValue<AuthUser?> _state = const AsyncValue.loading();
  AsyncValue<AuthUser?> get state => _state;

  AuthNotifier(this._api, this._storage) {
    _restore();
  }

  void _set(AsyncValue<AuthUser?> value) {
    _state = value;
    notifyListeners();
  }

  Future<void> _restore() async {
    try {
      final token = await _storage.read();
      if (token == null) {
        _set(const AsyncValue.data(null));
        return;
      }
      try {
        final json = await _api.getMe();
        _set(AsyncValue.data(AuthUser.fromJson(json, token)));
      } catch (_) {
        await _storage.delete();
        _set(const AsyncValue.data(null));
      }
    } catch (_) {
      _set(const AsyncValue.data(null));
    }
  }

  Future<void> login(String username, String password) async {
    _set(const AsyncValue.loading());
    try {
      final (:token, :user) = await _api.login(username, password);
      await _storage.save(token);
      _set(AsyncValue.data(AuthUser.fromJson(user, token)));
    } on DioException catch (e) {
      _set(AsyncValue.error(e, StackTrace.current));
    } catch (e) {
      _set(AsyncValue.error(e, StackTrace.current));
    }
  }

  Future<void> logout() async {
    await _storage.delete();
    _set(const AsyncValue.data(null));
  }
}

final authProvider = ChangeNotifierProvider<AuthNotifier>((ref) {
  return AuthNotifier(
    ref.watch(authApiProvider),
    ref.watch(tokenStorageProvider),
  );
});

final currentUserProvider = Provider<AuthUser?>((ref) {
  return ref.watch(authProvider).state.valueOrNull;
});
