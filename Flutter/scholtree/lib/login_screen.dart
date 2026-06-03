import 'package:flutter/material.dart';
import 'home_screen.dart';
import 'dati.dart';

/// schermata di accesso con username e password
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _userCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  String? _errore;

  void _login() {
    String u = _userCtrl.text.trim();
    String p = _passCtrl.text.trim();

    if (utenti.containsKey(u) && utenti[u] == p) {
      setState(() => _errore = null);
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (_) => HomeScreen(
            username: u,
            nome: infoUtenti[u]!['nome']!,
            ruolo: infoUtenti[u]!['ruolo']!,
            classe: infoUtenti[u]!['classe']!,
          ),
        ),
      );
    } else {
      setState(() => _errore = 'credenziali errate');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.school, size: 80, color: Colors.indigo),
              const SizedBox(height: 16),
              Text('Scholtree',
                  style: Theme.of(context).textTheme.headlineMedium),
              const SizedBox(height: 32),
              TextField(
                controller: _userCtrl,
                decoration: const InputDecoration(
                  labelText: 'username',
                  prefixIcon: Icon(Icons.person),
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _passCtrl,
                obscureText: true,
                decoration: const InputDecoration(
                  labelText: 'password',
                  prefixIcon: Icon(Icons.lock),
                  border: OutlineInputBorder(),
                ),
                onSubmitted: (_) => _login(),
              ),
              if (_errore != null)
                Padding(
                  padding: const EdgeInsets.only(top: 12),
                  child: Text(_errore!,
                      style: const TextStyle(color: Colors.red)),
                ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton(
                  onPressed: _login,
                  child: const Text('accedi'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
