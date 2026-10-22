import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/message.dart';

/// Gelembung chat (customer kiri, agent kanan, system tengah).
class MessageBubble extends StatelessWidget {
  final Message message;
  final int? myUserId;
  final VoidCallback? onDelete;

  const MessageBubble({
    super.key,
    required this.message,
    this.myUserId,
    this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final isSystem = message.senderType == 'SYSTEM';
    final isAgent = message.senderType == 'AGENT';
    final isMine = isAgent; // staff app: agen selalu di kanan

    if (isSystem) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 32),
        child: Center(
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: cs.surfaceContainerHigh,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              message.body,
              textAlign: TextAlign.center,
              style: TextStyle(
                  color: cs.onSurfaceVariant,
                  fontSize: 12,
                  fontStyle: FontStyle.italic),
            ),
          ),
        ),
      );
    }

    final bubbleColor = message.isFailed
        ? cs.errorContainer
        : (isMine ? cs.primaryContainer : cs.secondaryContainer);
    final textColor = message.isFailed
        ? cs.onErrorContainer
        : (isMine ? cs.onPrimaryContainer : cs.onSecondaryContainer);
    final timeStr =
        DateFormat('HH:mm').format(message.createdAt.toLocal());

    return Padding(
      padding: EdgeInsets.only(
        left: isMine ? 48 : 8,
        right: isMine ? 8 : 48,
        top: 3,
        bottom: 3,
      ),
      child: Align(
        alignment: isMine ? Alignment.centerRight : Alignment.centerLeft,
        child: Column(
          crossAxisAlignment:
              isMine ? CrossAxisAlignment.end : CrossAxisAlignment.start,
          children: [
            if (!isMine && message.senderName != null)
              Padding(
                padding: const EdgeInsets.only(left: 8, bottom: 2),
                child: Text(
                  message.senderName!,
                  style: TextStyle(
                      fontSize: 11,
                      color: cs.secondary,
                      fontWeight: FontWeight.w600),
                ),
              ),
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                color: bubbleColor,
                borderRadius: BorderRadius.only(
                  topLeft: const Radius.circular(16),
                  topRight: const Radius.circular(16),
                  bottomLeft: Radius.circular(isMine ? 16 : 4),
                  bottomRight: Radius.circular(isMine ? 4 : 16),
                ),
              ),
              child: Text(message.body,
                  style: TextStyle(color: textColor, fontSize: 14)),
            ),
            Padding(
              padding: const EdgeInsets.only(top: 2, left: 4, right: 4),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(timeStr,
                      style: TextStyle(
                          fontSize: 10, color: cs.onSurfaceVariant)),
                  if (message.isFailed) ...[
                    const SizedBox(width: 6),
                    Icon(Icons.error_outline, size: 12, color: cs.error),
                    const SizedBox(width: 2),
                    Text(
                      'Gagal terkirim',
                      style: TextStyle(fontSize: 10, color: cs.error),
                    ),
                    if (onDelete != null) ...[
                      const SizedBox(width: 4),
                      GestureDetector(
                        onTap: onDelete,
                        child: Icon(Icons.delete_outline,
                            size: 14, color: cs.error),
                      ),
                    ],
                  ] else if (isMine) ...[
                    const SizedBox(width: 4),
                    Icon(
                      message.isPending
                          ? Icons.access_time
                          : Icons.check,
                      size: 12,
                      color: message.isPending
                          ? cs.onSurfaceVariant
                          : cs.primary,
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
