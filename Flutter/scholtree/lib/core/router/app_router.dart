import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../auth/auth_provider.dart';
import '../../features/login/login_screen.dart';
import '../../features/home/dashboard_screen.dart';
import '../../features/home/home_screen.dart';
import '../../features/timetable/timetable_screen.dart';
import '../../features/directory/directory_screen.dart';

final routerProvider = Provider<GoRouter>((ref) {
  final notifier = ref.watch(authProvider);

  return GoRouter(
    initialLocation: '/home',
    refreshListenable: notifier,
    redirect: (_, state) {
      final auth = notifier.state;
      if (auth is AsyncLoading) return null;

      final loggedIn = auth is AsyncData && auth.value != null;
      final atLogin = state.matchedLocation == '/login';

      if (!loggedIn && !atLogin) return '/login';
      if (loggedIn && atLogin) return '/home';
      return null;
    },
    routes: [
      GoRoute(
        path: '/login',
        builder: (_, _) => const LoginScreen(),
      ),
      ShellRoute(
        builder: (_, _, child) => HomeScreen(child: child),
        routes: [
          GoRoute(
            path: '/home',
            builder: (_, _) => const DashboardScreen(),
          ),
          GoRoute(
            path: '/timetable',
            builder: (_, _) => const TimetableScreen(),
          ),
          GoRoute(
            path: '/directory',
            builder: (_, _) => const DirectoryScreen(),
          ),
        ],
      ),
    ],
  );
});
