import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/auth/auth_provider.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _userCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  bool _obscure = true;

  @override
  void dispose() {
    _userCtrl.dispose();
    _passCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final u = _userCtrl.text.trim();
    final p = _passCtrl.text;
    if (u.isEmpty || p.isEmpty) return;
    await ref.read(authProvider.notifier).login(u, p);
  }

  String _errorMsg(Object err) {
    if (err is DioException) {
      final code = err.response?.statusCode;
      if (code == 401) return 'credenziali non valide';
      if (code == 403) return 'account disattivato';
      return 'impossibile connettersi al server';
    }
    return 'errore sconosciuto';
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider).state;
    final loading = authState is AsyncLoading;

    ref.listen(authProvider, (_, notifier) {
      if (notifier.state is AsyncError) {
        final err = (notifier.state as AsyncError).error;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(_errorMsg(err)),
            backgroundColor: Colors.red,
          ),
        );
      }
    });

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.school, size: 72, color: Color(0xFF1565C0)),
                const SizedBox(height: 8),
                Text(
                  'Scholtree',
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                Text(
                  'ITIS L. da Vinci — Parma',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: Colors.grey,
                      ),
                ),
                const SizedBox(height: 40),
                TextField(
                  controller: _userCtrl,
                  decoration: const InputDecoration(
                    labelText: 'username',
                    prefixIcon: Icon(Icons.person_outline),
                  ),
                  textInputAction: TextInputAction.next,
                  autocorrect: false,
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _passCtrl,
                  decoration: InputDecoration(
                    labelText: 'password',
                    prefixIcon: const Icon(Icons.lock_outline),
                    suffixIcon: IconButton(
                      icon: Icon(
                        _obscure ? Icons.visibility_off : Icons.visibility,
                      ),
                      onPressed: () => setState(() => _obscure = !_obscure),
                    ),
                  ),
                  obscureText: _obscure,
                  textInputAction: TextInputAction.done,
                  onSubmitted: (_) => _submit(),
                ),
                const SizedBox(height: 24),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: loading ? null : _submit,
                    child: loading
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Text('accedi'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
