import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../core/theme.dart';
import '../models/ticket.dart';
import 'priority_badge.dart';

/// Card item tiket di daftar.
class TicketItem extends StatelessWidget {
  final Ticket ticket;
  final VoidCallback onTap;

  const TicketItem({super.key, required this.ticket, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final timeStr = _relativeTime(ticket.updatedAt);
    final textTheme = Theme.of(context).textTheme;

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 5),
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Baris 1: nomor tiket + waktu
              Row(
                children: [
                  Text(
                    ticket.number,
                    style: const TextStyle(
                      fontFamily: 'monospace',
                      color: AppColors.greenDark,
                      fontWeight: FontWeight.w700,
                      fontSize: 12.5,
                      letterSpacing: 0.4,
                    ),
                  ),
                  const Spacer(),
                  Text(
                    timeStr,
                    style: textTheme.bodySmall?.copyWith(
                      color: AppColors.muted,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              // Baris 2: nama customer
              Text(
                ticket.customer.name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 16,
                  letterSpacing: -0.2,
                ),
              ),
              const SizedBox(height: 3),
              // Baris 3: pratinjau pesan
              Text(
                ticket.lastMessage?.body ?? ticket.subject,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: textTheme.bodyMedium?.copyWith(
                  color: AppColors.muted,
                  fontSize: 13.5,
                ),
              ),
              const SizedBox(height: 12),
              // Baris 4: badge + agen
              Row(
                children: [
                  PriorityBadge(ticket: ticket, compact: true),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        const Icon(Icons.person_outline_rounded,
                            size: 14, color: AppColors.muted),
                        const SizedBox(width: 4),
                        Flexible(
                          child: Text(
                            ticket.assignedAgent != null
                                ? ticket.assignedAgent!.name
                                : 'Belum diambil',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: textTheme.bodySmall?.copyWith(
                              color: AppColors.muted,
                              fontSize: 12,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _relativeTime(DateTime dt) {
    final now = DateTime.now().toUtc();
    final diff = now.difference(dt.toUtc());
    if (diff.inMinutes < 1) return 'Baru saja';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m lalu';
    if (diff.inHours < 24) return '${diff.inHours}j lalu';
    return DateFormat('dd MMM', 'id').format(dt.toLocal());
  }
}
