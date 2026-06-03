import 'package:flutter/material.dart';

class OfflineBanner extends StatelessWidget {
  final String? lastUpdate;
  const OfflineBanner({super.key, this.lastUpdate});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      color: Colors.orange.shade100,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        children: [
          const Icon(Icons.cloud_off, size: 16, color: Colors.orange),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              lastUpdate != null
                  ? 'dati offline — ultimo aggiornamento: $lastUpdate'
                  : 'dati offline',
              style: const TextStyle(fontSize: 12),
            ),
          ),
        ],
      ),
    );
  }
}
