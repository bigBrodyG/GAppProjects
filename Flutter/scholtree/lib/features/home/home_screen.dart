import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/auth/auth_provider.dart';

class HomeScreen extends ConsumerWidget {
  final Widget child;
  const HomeScreen({super.key, required this.child});

  static const _tabs = [
    (path: '/home', icon: Icons.home_outlined, label: 'home'),
    (path: '/timetable', icon: Icons.calendar_month_outlined, label: 'orario'),
    (path: '/directory', icon: Icons.people_outline, label: 'rubrica'),
  ];

  int _tabIndex(BuildContext context) {
    final loc = GoRouterState.of(context).matchedLocation;
    for (var i = 0; i < _tabs.length; i++) {
      if (loc.startsWith(_tabs[i].path)) return i;
    }
    return 0;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    final idx = _tabIndex(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Scholtree'),
        actions: [
          PopupMenuButton(
            icon: CircleAvatar(
              radius: 16,
              child: Text(
                user?.name.isNotEmpty == true
                    ? user!.name[0].toUpperCase()
                    : '?',
              ),
            ),
            itemBuilder: (_) => [
              PopupMenuItem(
                onTap: () => ref.read(authProvider.notifier).logout(),
                child: const Row(
                  children: [
                    Icon(Icons.logout),
                    SizedBox(width: 8),
                    Text('esci'),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
      body: child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: idx,
        onDestinationSelected: (i) => context.go(_tabs[i].path),
        destinations: _tabs
            .map((t) => NavigationDestination(
                  icon: Icon(t.icon),
                  label: t.label,
                ))
            .toList(),
      ),
    );
  }
}
