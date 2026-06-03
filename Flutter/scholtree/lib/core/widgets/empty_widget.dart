import 'package:flutter/material.dart';

class AppEmpty extends StatelessWidget {
  final IconData icon;
  final String message;

  const AppEmpty({
    super.key,
    this.icon = Icons.inbox_outlined,
    required this.message,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 48, color: Colors.grey),
          const SizedBox(height: 12),
          Text(message, style: const TextStyle(color: Colors.grey)),
        ],
      ),
    );
  }
}
