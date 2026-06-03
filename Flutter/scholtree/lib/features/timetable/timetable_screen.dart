import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api/data_api.dart';
import '../../core/widgets/empty_widget.dart';
import 'resource_picker.dart';
import 'timetable_image_view.dart';
import 'timetable_provider.dart';

class TimetableScreen extends ConsumerWidget {
  const TimetableScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final type = ref.watch(selectedTypeProvider);
    final code = ref.watch(selectedCodeProvider);

    return Column(
      children: [
        const ResourcePicker(),
        const Divider(height: 1),
        Expanded(
          child: code == null
              ? const AppEmpty(
                  icon: Icons.calendar_today_outlined,
                  message: 'seleziona una risorsa per vedere l\'orario',
                )
              : TimetableImageView(
                  url: ref.read(dataApiProvider).timetableImageUrl(type, code),
                ),
        ),
      ],
    );
  }
}
