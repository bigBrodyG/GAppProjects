import 'package:flutter/material.dart';
import 'login_screen.dart';
import 'theme.dart';

void main() {
  runApp(
    ValueListenableBuilder<bool>(
      valueListenable: isDarkMode,
      builder: (_, isDark, _) => MyApp(isDark: isDark),
    ),
  );
}

class MyApp extends StatelessWidget {
  final bool isDark;
  const MyApp({super.key, required this.isDark});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Scholtree',
      debugShowCheckedModeBanner: false,
      theme: lightTheme,
      darkTheme: darkTheme,
      themeMode: isDark ? ThemeMode.dark : ThemeMode.light,
      home: const LoginScreen(),
    );
  }
}
