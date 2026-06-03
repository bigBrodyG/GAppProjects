import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'client.dart';

const _baseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://localhost:3000',
);

class Resource {
  final String code;
  final String name;
  const Resource({required this.code, required this.name});
}

class DataApi {
  final Dio _dio;
  DataApi(this._dio);

  Future<List<Resource>> getResources(String type) async {
    // type: 'class' | 'room' | 'teacher'
    final endpoint = switch (type) {
      'class' => '/timetable/classes',
      'room' => '/timetable/rooms',
      'teacher' => '/timetable/teachers',
      _ => throw ArgumentError('unknown type $type'),
    };
    final res = await _dio.get<Map<String, dynamic>>(endpoint);
    final data = res.data!['data'] as List<dynamic>;
    return data
        .map((e) => Resource(
              code: (e as Map<String, dynamic>)['code'] as String,
              name: e['name'] as String,
            ))
        .toList();
  }

  String timetableImageUrl(String type, String code) =>
      '$_baseUrl/api/timetable/image/$type/$code';

  Future<List<Map<String, dynamic>>> searchDirectory(
    String q, {
    String? role,
    int limit = 20,
    int offset = 0,
  }) async {
    final res = await _dio.get<Map<String, dynamic>>('/directory/search', queryParameters: {
      'q': q,
      if (role != null) 'role': role,
      'limit': limit,
      'offset': offset,
    });
    return (res.data!['data'] as List<dynamic>).cast<Map<String, dynamic>>();
  }
}

final dataApiProvider = Provider<DataApi>(
  (ref) => DataApi(ref.watch(dioProvider)),
);
