import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'client.dart';

class AuthUser {
  final int id;
  final String ldapUid;
  final String name;
  final String role;
  final String? department;
  final String? className;
  final String? email;
  final String? teacherResourceCode;
  final String token;

  const AuthUser({
    required this.id,
    required this.ldapUid,
    required this.name,
    required this.role,
    this.department,
    this.className,
    this.email,
    this.teacherResourceCode,
    required this.token,
  });

  factory AuthUser.fromJson(Map<String, dynamic> j, String token) => AuthUser(
        id: j['id'] as int,
        ldapUid: j['ldap_uid'] as String,
        name: j['name'] as String,
        role: j['role'] as String,
        department: j['department'] as String?,
        className: j['class_name'] as String?,
        email: j['email'] as String?,
        teacherResourceCode: j['teacher_resource_code'] as String?,
        token: token,
      );
}

class AuthApi {
  final Dio _dio;
  AuthApi(this._dio);

  Future<({String token, Map<String, dynamic> user})> login(
    String username,
    String password,
  ) async {
    final res = await _dio.post<Map<String, dynamic>>('/auth/login', data: {
      'username': username,
      'password': password,
    });
    final data = res.data!;
    return (
      token: data['token'] as String,
      user: data['user'] as Map<String, dynamic>,
    );
  }

  Future<Map<String, dynamic>> getMe() async {
    final res = await _dio.get<Map<String, dynamic>>('/auth/me');
    return res.data!;
  }
}

final authApiProvider = Provider<AuthApi>(
  (ref) => AuthApi(ref.watch(dioProvider)),
);
