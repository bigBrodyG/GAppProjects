import 'package:flutter/material.dart';
import 'dati.dart';
import 'dettaglio.dart';

/// home con orario di oggi + elenco prof
class HomeScreen extends StatefulWidget {
  final String nome;
  final String classe;

  const HomeScreen({super.key, required this.nome, required this.classe});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  String _ricerca = '';

  // giorno della settimana in italiano
  String _giorno(DateTime d) {
    const giorni = {
      1: 'lunedì', 2: 'martedì', 3: 'mercoledì',
      4: 'giovedì', 5: 'venerdì', 6: 'sabato', 7: 'domenica'
    };
    return giorni[d.weekday] ?? '';
  }

  @override
  Widget build(BuildContext context) {
    DateTime oggi = DateTime.now();
    String g = _giorno(oggi);
    List<String> lezioni = orario[g] ?? List.filled(ore.length, '');
    List<String> valide = lezioni.where((l) => l.isNotEmpty).toList();

    // filtra prof
    List<Map<String, String>> filtrati = prof.where((p) {
      if (_ricerca.isEmpty) return true;
      return p['nome']!.toLowerCase().contains(_ricerca.toLowerCase());
    }).toList();

    return Scaffold(
      appBar: AppBar(
        title: Text('scholtree · ${widget.classe}'),
        backgroundColor: Colors.blue,
        foregroundColor: Colors.white,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── benvenuto ──
            Text('ciao ${widget.nome}',
                style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),

            // ── oggi ──
            Text(g, style: const TextStyle(fontSize: 18, color: Colors.blue)),
            Text('${oggi.day}/${oggi.month}/${oggi.year}',
                style: const TextStyle(color: Colors.grey)),
            const SizedBox(height: 12),

            // ── lezioni ──
            if (valide.isNotEmpty) ...[
              const Text('lezioni oggi:',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    children: [
                      for (int i = 0; i < lezioni.length; i++)
                        if (lezioni[i].isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.symmetric(vertical: 4),
                            child: Row(
                              children: [
                                Container(
                                  width: 50,
                                  padding: const EdgeInsets.all(4),
                                  color: Colors.blue.shade50,
                                  child: Text(ore[i],
                                      textAlign: TextAlign.center,
                                      style: const TextStyle(
                                          fontSize: 12, fontWeight: FontWeight.bold)),
                                ),
                                const SizedBox(width: 12),
                                Text(lezioni[i],
                                    style: const TextStyle(fontWeight: FontWeight.w600)),
                              ],
                            ),
                          ),
                    ],
                  ),
                ),
              ),
            ] else ...[
              const Card(
                child: Padding(
                  padding: EdgeInsets.all(16),
                  child: Text('nessuna lezione oggi!'),
                ),
              ),
            ],
            const SizedBox(height: 24),

            // ── professori ──
            const Text('professori:',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            TextField(
              onChanged: (v) => setState(() => _ricerca = v),
              decoration: const InputDecoration(
                hintText: 'cerca prof...',
                prefixIcon: Icon(Icons.search),
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 8),
            Text('${filtrati.length} prof',
                style: const TextStyle(fontSize: 12, color: Colors.grey)),
            const SizedBox(height: 4),
            if (filtrati.isEmpty)
              const Padding(
                padding: EdgeInsets.all(20),
                child: Text('nessun risultato'),
              )
            else
              Column(
                children: [
                  for (var p in filtrati)
                    Card(
                      child: ListTile(
                        leading: CircleAvatar(
                          backgroundColor: Colors.blue.shade100,
                          child: Text(_iniziali(p['nome']!),
                              style: const TextStyle(fontWeight: FontWeight.bold)),
                        ),
                        title: Text(p['nome']!),
                        subtitle: Text(p['mat'] ?? ''),
                        onTap: () => Navigator.push(context, MaterialPageRoute(
                          builder: (_) => DettaglioProf(p: p),
                        )),
                      ),
                    ),
                ],
              ),
          ],
        ),
      ),
    );
  }

  String _iniziali(String n) {
    var parole = n.split(' ');
    var ris = '';
    for (var i = 0; i < parole.length && ris.length < 2; i++) {
      if (parole[i].isNotEmpty) ris += parole[i][0];
    }
    return ris;
  }
}
