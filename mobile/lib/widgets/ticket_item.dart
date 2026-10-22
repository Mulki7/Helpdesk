import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/ticket.dart';
import 'priority_badge.dart';

/// Card item tiket di daftar.
class TicketItem extends StatelessWidget {
  final Ticket ticket;
  final VoidCallback onTap;

  const TicketItem({super.key, required this.ticket, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final timeStr = _relativeTime(ticket.updatedAt);

    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Text(
                    ticket.number,
                    style: TextStyle(
                        color: cs.primary,
                        fontWeight: FontWeight.bold,
                        fontSize: 12),
                  ),
                  const Spacer(),
                  PriorityBadge(ticket: ticket, compact: true),
                  const SizedBox(width: 6),
                  Text(timeStr,
                      style: Theme.of(context)
                          .textTheme
                          .bodySmall
                          ?.copyWith(color: cs.onSurfaceVariant)),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                ticket.customer.name,
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 2),
              Text(
                ticket.lastMessage?.body ?? ticket.subject,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context)
                    .textTheme
                    .bodySmall
                    ?.copyWith(color: cs.onSurfaceVariant),
              ),
              if (ticket.assignedAgent != null) ...[
                const SizedBox(height: 4),
                Text(
                  'Agen: ${ticket.assignedAgent!.name}',
                  style: Theme.of(context)
                      .textTheme
                      .bodySmall
                      ?.copyWith(color: cs.secondary),
                ),
              ],
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
