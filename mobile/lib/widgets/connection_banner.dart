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

    final bg = isConnecting ? const Color(0xFFFEF3C7) : cs.errorContainer;
    final fg = isConnecting ? const Color(0xFF92400E) : cs.onErrorContainer;

    return InkWell(
      onTap: () => conn.reconnect(),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 300),
        width: double.infinity,
        color: bg,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (isConnecting)
              SizedBox(
                width: 14,
                height: 14,
                child: CircularProgressIndicator(strokeWidth: 2, color: fg),
              )
            else
              Icon(Icons.wifi_off_rounded, size: 16, color: fg),
            const SizedBox(width: 8),
            Flexible(
              child: Text.rich(
                TextSpan(
                  children: [
                    TextSpan(
                      text: conn.label,
                      style: TextStyle(
                        color: fg,
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    TextSpan(
                      text: '  Ketuk untuk coba lagi',
                      style: TextStyle(
                        color: fg.withAlpha(180),
                        fontSize: 11.5,
                      ),
                    ),
                  ],
                ),
                textAlign: TextAlign.center,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
