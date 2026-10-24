import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../core/theme.dart';
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
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 32),
        child: Center(
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
            decoration: const ShapeDecoration(
              color: Colors.white,
              shape: StadiumBorder(side: BorderSide(color: AppColors.border)),
            ),
            child: Text(
              message.body,
              textAlign: TextAlign.center,
              style: const TextStyle(
                  color: AppColors.muted,
                  fontSize: 12,
                  fontWeight: FontWeight.w500),
            ),
          ),
        ),
      );
    }

    // Agen = hitam (kanan), customer = putih berborder (kiri)
    final bubbleColor = message.isFailed
        ? cs.errorContainer
        : (isMine ? AppColors.ink : Colors.white);
    final textColor = message.isFailed
        ? cs.onErrorContainer
        : (isMine ? Colors.white : AppColors.ink);
    final timeStr =
        DateFormat('HH:mm').format(message.createdAt.toLocal());

    return Padding(
      padding: EdgeInsets.only(
        left: isMine ? 56 : 8,
        right: isMine ? 8 : 56,
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
                  style: const TextStyle(
                      fontSize: 11.5,
                      color: AppColors.muted,
                      fontWeight: FontWeight.w600),
                ),
              ),
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              decoration: BoxDecoration(
                color: bubbleColor,
                border: (isMine && !message.isFailed)
                    ? null
                    : Border.all(
                        color: message.isFailed
                            ? cs.error.withAlpha(90)
                            : AppColors.border),
                borderRadius: BorderRadius.only(
                  topLeft: const Radius.circular(20),
                  topRight: const Radius.circular(20),
                  bottomLeft: Radius.circular(isMine ? 20 : 6),
                  bottomRight: Radius.circular(isMine ? 6 : 20),
                ),
              ),
              child: Text(message.body,
                  style: TextStyle(color: textColor, fontSize: 14.5, height: 1.35)),
            ),
            Padding(
              padding: const EdgeInsets.only(top: 3, left: 6, right: 6),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(timeStr,
                      style: TextStyle(
                          fontSize: 10.5, color: AppColors.muted)),
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
                          ? AppColors.muted
                          : AppColors.green,
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
