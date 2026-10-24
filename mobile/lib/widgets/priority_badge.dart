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
        const SizedBox(width: 8),
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
    // (label, latar, teks, border)
    final (label, bg, fg, border) = switch (status) {
      'OPEN' => (
          'Terbuka',
          const Color(0xFFE7F6EC),
          const Color(0xFF166534),
          const Color(0xFFBFE5CB)
        ),
      'IN_PROGRESS' => (
          'Proses',
          const Color(0xFFFEF3C7),
          const Color(0xFF92400E),
          const Color(0xFFFCE3A0)
        ),
      'RESOLVED' => (
          'Selesai',
          const Color(0xFFDBEAFE),
          const Color(0xFF1E40AF),
          const Color(0xFFBBD4FB)
        ),
      'CLOSED' => (
          'Ditutup',
          const Color(0xFFF3F4F6),
          const Color(0xFF4B5563),
          const Color(0xFFE5E7EB)
        ),
      _ => (
          status,
          const Color(0xFFF3F4F6),
          const Color(0xFF4B5563),
          const Color(0xFFE5E7EB)
        ),
    };

    return Container(
      padding: EdgeInsets.symmetric(
          horizontal: compact ? 10 : 12, vertical: compact ? 3 : 4),
      decoration: ShapeDecoration(
        color: bg,
        shape: StadiumBorder(side: BorderSide(color: border)),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: compact ? 11 : 12,
          fontWeight: FontWeight.w600,
          color: fg,
        ),
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
      'HIGH' => const Color(0xFFEF4444),
      'MEDIUM' => const Color(0xFFF59E0B),
      'LOW' => const Color(0xFF22C55E),
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
        width: 12,
        height: 12,
        decoration: BoxDecoration(
          color: color.withAlpha(40),
          shape: BoxShape.circle,
        ),
        alignment: Alignment.center,
        child: Container(
          width: 7,
          height: 7,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
      ),
    );
  }
}
