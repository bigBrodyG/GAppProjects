import 'package:flutter/material.dart';
import 'dati.dart';

/// home page con navigazione a tab: home / orario / rubrica
class HomeScreen extends StatefulWidget {
  final String username;
  final String nome;
  final String ruolo;
  final String classe;

  const HomeScreen({
    super.key,
    required this.username,
    required this.nome,
    required this.ruolo,
    required this.classe,
  });

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _tab = 0;

  static const _label = ['home', 'orario', 'rubrica'];
  static const _icon = [Icons.home, Icons.calendar_month, Icons.people];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Scholtree'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'esci',
            onPressed: () => Navigator.pop(context),
          ),
        ],
      ),
      body: _tab == 0
          ? _HomeTab(nome: widget.nome, ruolo: widget.ruolo, classe: widget.classe)
          : _tab == 1
              ? _OrarioTab(classe: widget.classe)
              : _RubricaTab(),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _tab,
        onTap: (i) => setState(() => _tab = i),
        items: [
          BottomNavigationBarItem(icon: Icon(_icon[0]), label: _label[0]),
          BottomNavigationBarItem(icon: Icon(_icon[1]), label: _label[1]),
          BottomNavigationBarItem(icon: Icon(_icon[2]), label: _label[2]),
        ],
      ),
    );
  }
}

// ---------- tab home ----------

class _HomeTab extends StatelessWidget {
  final String nome;
  final String ruolo;
  final String classe;
  const _HomeTab(
      {required this.nome, required this.ruolo, required this.classe});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const CircleAvatar(radius: 40, child: Icon(Icons.person, size: 40)),
          const SizedBox(height: 12),
          Text(nome, style: Theme.of(context).textTheme.titleLarge),
          Text('$ruolo — classe $classe'),
        ],
      ),
    );
  }
}

// ---------- tab orario ----------

class _OrarioTab extends StatelessWidget {
  final String classe;
  const _OrarioTab({required this.classe});

  @override
  Widget build(BuildContext context) {
    // orario hardcoded per classe 4C
    if (classe != '4C') {
      return const Center(child: Text('orario non ancora disponibile'));
    }

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(8),
        child: DataTable(
          columns: [
            const DataColumn(label: Text('ora')),
            ...orario4C.keys.map((g) => DataColumn(label: Text(g))),
          ],
          rows: List.generate(ore.length, (i) {
            return DataRow(cells: [
              DataCell(Text(ore[i])),
              ...orario4C.keys.map((g) => DataCell(Text(orario4C[g]![i]))),
            ]);
          }),
        ),
      ),
    );
  }
}

// ---------- tab rubrica ----------

class _RubricaTab extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      padding: const EdgeInsets.all(8),
      itemCount: rubrica.length,
      itemBuilder: (_, i) {
        var p = rubrica[i];
        return Card(
          child: ListTile(
            leading: const CircleAvatar(child: Icon(Icons.person)),
            title: Text(p['nome']!),
            subtitle: Text('${p['materia']} — ${p['email']}'),
          ),
        );
      },
    );
  }
}
