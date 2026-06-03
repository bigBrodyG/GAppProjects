import 'package:flutter/material.dart';
import 'dati.dart';
import 'home_screen.dart';

/// schermata di login
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _user = TextEditingController();
  final _pass = TextEditingController();
  String? _err;
  bool _caricamento = false;

  void _login() {
    String u = _user.text.trim();
    String p = _pass.text.trim();

    if (u.isEmpty || p.isEmpty) {
      setState(() => _err = 'inserisci username e password');
      return;
    }

    setState(() => _caricamento = true);

    // simulazione attesa
    Future.delayed(const Duration(milliseconds: 500), () {
      if (utenti.containsKey(u) && utenti[u] == p) {
        var info = infoUtenti[u]!;
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(
            builder: (_) => HomeScreen(
              nome: info['nome']!,
              classe: info['classe']!,
            ),
          ),
        );
      } else {
        setState(() {
          _err = 'credenziali errate';
          _caricamento = false;
        });
      }
    });
  }

  @override
  void dispose() {
    _user.dispose();
    _pass.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('scholtree')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.school, size: 64, color: Colors.blue),
            const SizedBox(height: 24),
            TextField(
              controller: _user,
              decoration: const InputDecoration(
                labelText: 'username',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _pass,
              obscureText: true,
              decoration: const InputDecoration(
                labelText: 'password',
                border: OutlineInputBorder(),
              ),
            ),
            if (_err != null)
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: Text(_err!, style: const TextStyle(color: Colors.red)),
              ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              height: 48,
              child: FilledButton(
                onPressed: _caricamento ? null : _login,
                child: _caricamento
                    ? const CircularProgressIndicator(strokeWidth: 2)
                    : const Text('accedi'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
