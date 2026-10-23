import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/connection_provider.dart';
import '../data/socket/socket_service.dart';

/// Banner status koneksi yang tampil di atas layar chat/tiket.
class ConnectionBanner extends StatelessWidget {
  const ConnectionBanner({super.key});

  @override
  Widget build(BuildContext context) {
    final conn = context.watch<ConnectionProvider>();

    if (conn.status == SocketStatus.connected) {
      return const SizedBox.shrink();
    }

    final isConnecting = conn.status == SocketStatus.connecting;
    final cs = Theme.of(context).colorScheme;

    return InkWell(
      onTap: () => conn.reconnect(),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 300),
        width: double.infinity,
        color: isConnecting ? Colors.orange.shade700 : cs.errorContainer,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (isConnecting) ...[
              const SizedBox(
                width: 14,
                height: 14,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: Colors.white,
                ),
              ),
              const SizedBox(width: 8),
            ] else
              Icon(Icons.wifi_off, size: 16, color: cs.onErrorContainer),
            const SizedBox(width: 6),
            Text(
              conn.label,
              style: TextStyle(
                color: isConnecting ? Colors.white : cs.onErrorContainer,
                fontSize: 13,
                fontWeight: FontWeight.w500,
              ),
            ),
            const SizedBox(width: 8),
            Text(
              '(Ketuk untuk coba lagi)',
              style: TextStyle(
                color: isConnecting ? Colors.white70 : cs.onErrorContainer.withAlpha(180),
                fontSize: 11,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
