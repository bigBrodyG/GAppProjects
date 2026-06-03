import 'package:flutter/material.dart';

/// mostra i dettagli di un docente della rubrica
class ProfessoreScreen extends StatelessWidget {
  final Map<String, String> docente;
  const ProfessoreScreen({super.key, required this.docente});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(docente['nome']!)),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const CircleAvatar(radius: 48, child: Icon(Icons.person, size: 48)),
            const SizedBox(height: 16),
            Text(docente['nome']!, style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 24),
            _riga(Icons.school, 'materia', docente['materia']!),
            const SizedBox(height: 12),
            _riga(Icons.email, 'email', docente['email']!),
            if (docente.containsKey('telefono'))
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: _riga(Icons.phone, 'telefono', docente['telefono']!),
              ),
          ],
        ),
      ),
    );
  }

  Widget _riga(IconData icon, String label, String valore) {
    return Row(
      children: [
        Icon(icon, size: 20, color: Colors.indigo),
        const SizedBox(width: 8),
        Text('$label: ', style: const TextStyle(fontWeight: FontWeight.bold)),
        Text(valore),
      ],
    );
  }
}
