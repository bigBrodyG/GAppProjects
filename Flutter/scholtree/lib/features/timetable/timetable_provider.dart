import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api/data_api.dart';

// Selected resource type: 'class' | 'room' | 'teacher'
final selectedTypeProvider = StateProvider<String>((ref) => 'class');

// Resources list for current type
final resourcesProvider = FutureProvider.autoDispose.family<List<Resource>, String>(
  (ref, type) => ref.watch(dataApiProvider).getResources(type),
);

// Selected resource code
final selectedCodeProvider = StateProvider<String?>((ref) => null);
