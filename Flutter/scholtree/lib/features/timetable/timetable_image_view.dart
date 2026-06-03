import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/auth/auth_provider.dart';

class TimetableImageView extends ConsumerWidget {
  final String url;
  const TimetableImageView({super.key, required this.url});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    final headers = user != null
        ? {'Authorization': 'Bearer ${user.token}'}
        : <String, String>{};

    return InteractiveViewer(
      minScale: 1.0,
      maxScale: 4.0,
      child: CachedNetworkImage(
        imageUrl: url,
        httpHeaders: headers,
        fit: BoxFit.contain,
        placeholder: (context, url) => const Center(
          child: CircularProgressIndicator(),
        ),
        errorWidget: (context, url, err) => const Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.broken_image_outlined, size: 48, color: Colors.grey),
              SizedBox(height: 8),
              Text('orario non disponibile per questa risorsa'),
            ],
          ),
        ),
      ),
    );
  }
}
