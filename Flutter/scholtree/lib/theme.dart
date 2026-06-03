import 'package:flutter/material.dart';

const _lavanda = Color(0xFF9C89B8);
const _menta = Color(0xFF7EC8C0);
const _pesca = Color(0xFFF0A898);

final ValueNotifier<bool> isDarkMode = ValueNotifier(false);

final lightTheme = ThemeData(
  useMaterial3: true,
  colorScheme: ColorScheme.light(
    primary: _lavanda,
    secondary: _menta,
    tertiary: _pesca,
    surface: Color(0xFFF8F7FC),
  ),
  scaffoldBackgroundColor: const Color(0xFFF8F7FC),
);

final darkTheme = ThemeData(
  useMaterial3: true,
  colorScheme: ColorScheme.dark(
    primary: const Color(0xFFB8A9D4),
    secondary: const Color(0xFFA8E6DC),
    tertiary: const Color(0xFFF5C4B8),
    surface: const Color(0xFF2A2A3C),
  ),
  scaffoldBackgroundColor: const Color(0xFF1A1A2E),
);
