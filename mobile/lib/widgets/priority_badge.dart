import 'package:flutter/material.dart';
import '../models/ticket.dart';

/// Badge status dan prioritas tiket.
class PriorityBadge extends StatelessWidget {
  final Ticket ticket;
  final bool compact;

  const PriorityBadge({super.key, required this.ticket, this.compact = false});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        _StatusChip(status: ticket.status, compact: compact),
        const SizedBox(width: 4),
        _PriorityDot(priority: ticket.priority),
      ],
    );
  }
}

class _StatusChip extends StatelessWidget {
  final String status;
  final bool compact;
  const _StatusChip({required this.status, required this.compact});

  @override
  Widget build(BuildContext context) {
    final (label, color, textColor) = switch (status) {
      'OPEN' => ('Terbuka', Colors.blue.shade100, Colors.blue.shade900),
      'IN_PROGRESS' => ('Proses', Colors.orange.shade100, Colors.orange.shade900),
      'RESOLVED' => ('Selesai', Colors.green.shade100, Colors.green.shade900),
      'CLOSED' => ('Ditutup', Colors.grey.shade200, Colors.grey.shade700),
      _ => (status, Colors.grey.shade200, Colors.grey.shade700),
    };

    return Container(
      padding: EdgeInsets.symmetric(
          horizontal: compact ? 6 : 8, vertical: compact ? 2 : 3),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label,
        style: TextStyle(
            fontSize: compact ? 10 : 11,
            fontWeight: FontWeight.w600,
            color: textColor),
      ),
    );
  }
}

class _PriorityDot extends StatelessWidget {
  final String priority;
  const _PriorityDot({required this.priority});

  @override
  Widget build(BuildContext context) {
    final color = switch (priority) {
      'HIGH' => Colors.red,
      'MEDIUM' => Colors.orange,
      'LOW' => Colors.green,
      _ => Colors.grey,
    };
    return Tooltip(
      message: switch (priority) {
        'HIGH' => 'Prioritas Tinggi',
        'MEDIUM' => 'Prioritas Sedang',
        'LOW' => 'Prioritas Rendah',
        _ => priority,
      },
      child: Container(
        width: 10,
        height: 10,
        decoration: BoxDecoration(
          color: color,
          shape: BoxShape.circle,
        ),
      ),
    );
  }
}
