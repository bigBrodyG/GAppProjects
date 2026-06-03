import 'package:flutter/material.dart';

/// pagina dettaglio professore
class DettaglioProf extends StatelessWidget {
  final Map<String, String> p;
  const DettaglioProf({super.key, required this.p});

  String _iniziali(String n) {
    var parole = n.split(' ');
    var ris = '';
    for (var i = 0; i < parole.length && ris.length < 2; i++) {
      if (parole[i].isNotEmpty) ris += parole[i][0];
    }
    return ris;
  }

  @override
  Widget build(BuildContext context) {
    var da = '';
    if (p['creazione_account'] != null && p['creazione_account']!.isNotEmpty) {
      var anno = int.parse(p['creazione_account']!.substring(0, 4));
      var a = DateTime.now().year - anno;
      da = 'insegna all\'itis da $a anni';
    }

    return Scaffold(
      appBar: AppBar(title: Text(p['nome'] ?? '')),
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircleAvatar(
              radius: 40,
              backgroundColor: Colors.grey.shade300,
              child: Text(_iniziali(p['nome']!),
                  style: const TextStyle(fontSize: 24, color: Colors.black54)),
            ),
            const SizedBox(height: 16),
            Text(p['nome']!,
                style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Text(p['mat'] ?? '', style: const TextStyle(color: Colors.grey)),
            const SizedBox(height: 6),
            Text(p['mail'] ?? '', style: const TextStyle(color: Colors.grey)),
            if (da.isNotEmpty) ...[
              const SizedBox(height: 6),
              Text(da, style: const TextStyle(color: Colors.grey, fontSize: 13)),
            ],
          ],
        ),
      ),
    );
  }
}
