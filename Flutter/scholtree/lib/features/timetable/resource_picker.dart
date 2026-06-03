import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/widgets/loading_widget.dart';
import 'timetable_provider.dart';

class ResourcePicker extends ConsumerWidget {
  const ResourcePicker({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final type = ref.watch(selectedTypeProvider);
    final resources = ref.watch(resourcesProvider(type));
    final selectedCode = ref.watch(selectedCodeProvider);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Type selector
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            children: [
              for (final (t, label) in [
                ('class', 'classi'),
                ('room', 'aule'),
                ('teacher', 'docenti'),
              ])
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: Text(label),
                    selected: type == t,
                    onSelected: (_) {
                      ref.read(selectedTypeProvider.notifier).state = t;
                      ref.read(selectedCodeProvider.notifier).state = null;
                    },
                  ),
                ),
            ],
          ),
        ),
        // Resource dropdown
        resources.when(
          loading: () => const Padding(
            padding: EdgeInsets.all(16),
            child: AppLoading(),
          ),
          error: (e, _) => Padding(
            padding: const EdgeInsets.all(16),
            child: Text('errore caricamento: $e'),
          ),
          data: (list) {
            if (list.isEmpty) {
              return const Padding(
                padding: EdgeInsets.all(16),
                child: Text('nessuna risorsa disponibile'),
              );
            }
            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: DropdownButtonFormField<String>(
                initialValue: selectedCode,
                hint: Text('seleziona ${_typeLabel(type)}'),
                isExpanded: true,
                items: list
                    .map((r) => DropdownMenuItem(
                          value: r.code,
                          child: Text(r.name, overflow: TextOverflow.ellipsis),
                        ))
                    .toList(),
                onChanged: (code) {
                  ref.read(selectedCodeProvider.notifier).state = code;
                },
              ),
            );
          },
        ),
      ],
    );
  }

  String _typeLabel(String type) => switch (type) {
        'class' => 'classe',
        'room' => 'aula',
        'teacher' => 'docente',
        _ => type,
      };
}
