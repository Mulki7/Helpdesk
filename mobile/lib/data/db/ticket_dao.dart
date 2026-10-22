import 'package:sqflite/sqflite.dart';
import '../../models/ticket.dart';
import 'database.dart';

/// DAO untuk tabel tickets (cache lokal).
class TicketDao {
  final _db = AppDatabase.instance;

  Map<String, dynamic> _ticketToMap(Ticket t) {
    return {
      'id': t.id,
      'number': t.number,
      'subject': t.subject,
      'status': t.status,
      'priority': t.priority,
      'customer_id': t.customer.id,
      'customer_name': t.customer.name,
      'customer_email': t.customer.email,
      'assigned_agent_id': t.assignedAgent?.id,
      'assigned_agent_name': t.assignedAgent?.name,
      'last_message_body': t.lastMessage?.body,
      'last_message_sender_type': t.lastMessage?.senderType,
      'last_message_at': t.lastMessage?.createdAt.toIso8601String(),
      'created_at': t.createdAt.toIso8601String(),
      'updated_at': t.updatedAt.toIso8601String(),
    };
  }

  Ticket _mapToTicket(Map<String, dynamic> map) {
    return Ticket(
      id: map['id'] as int,
      number: map['number'] as String,
      subject: map['subject'] as String,
      status: map['status'] as String,
      priority: map['priority'] as String,
      customer: TicketCustomer(
        id: map['customer_id'] as int,
        name: map['customer_name'] as String,
        email: map['customer_email'] as String?,
      ),
      assignedAgent: map['assigned_agent_id'] != null
          ? TicketAgent(
              id: map['assigned_agent_id'] as int,
              name: map['assigned_agent_name'] as String,
            )
          : null,
      lastMessage: map['last_message_body'] != null
          ? TicketLastMessage(
              body: map['last_message_body'] as String,
              senderType: map['last_message_sender_type'] as String,
              createdAt: DateTime.parse(map['last_message_at'] as String),
            )
          : null,
      createdAt: DateTime.parse(map['created_at'] as String),
      updatedAt: DateTime.parse(map['updated_at'] as String),
    );
  }

  Future<void> upsertAll(List<Ticket> tickets) async {
    final db = await _db.database;
    final batch = db.batch();
    for (final t in tickets) {
      batch.insert(
        'tickets',
        _ticketToMap(t),
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
    }
    await batch.commit(noResult: true);
  }

  Future<void> upsert(Ticket t) async {
    final db = await _db.database;
    await db.insert(
      'tickets',
      _ticketToMap(t),
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<List<Ticket>> getAll() async {
    final db = await _db.database;
    final rows = await db.query('tickets', orderBy: 'updated_at DESC');
    return rows.map(_mapToTicket).toList();
  }

  Future<Ticket?> getById(int id) async {
    final db = await _db.database;
    final rows = await db.query('tickets', where: 'id = ?', whereArgs: [id]);
    if (rows.isEmpty) return null;
    return _mapToTicket(rows.first);
  }

  Future<void> clear() async {
    final db = await _db.database;
    await db.delete('tickets');
  }
}
