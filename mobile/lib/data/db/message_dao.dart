import 'package:sqflite/sqflite.dart';
import '../../models/message.dart';
import 'database.dart';

/// DAO untuk tabel messages (cache lokal).
class MessageDao {
  final _db = AppDatabase.instance;

  Map<String, dynamic> _toMap(Message m) {
    return {
      'id': m.id,
      'ticket_id': m.ticketId,
      'sender_type': m.senderType,
      'sender_name': m.senderName,
      'body': m.body,
      'client_message_id': m.clientMessageId,
      'created_at': m.createdAt.toIso8601String(),
      'is_pending': m.isPending ? 1 : 0,
    };
  }

  Message _fromMap(Map<String, dynamic> map) {
    return Message(
      id: map['id'] as int,
      ticketId: map['ticket_id'] as int,
      senderType: map['sender_type'] as String,
      senderName: map['sender_name'] as String?,
      body: map['body'] as String,
      clientMessageId: map['client_message_id'] as String?,
      createdAt: DateTime.parse(map['created_at'] as String),
      isPending: (map['is_pending'] as int) == 1,
    );
  }

  Future<void> upsertAll(List<Message> messages) async {
    final db = await _db.database;
    final batch = db.batch();
    for (final m in messages) {
      if (m.id < 0) continue; // skip local-only pending
      batch.insert(
        'messages',
        _toMap(m),
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
    }
    await batch.commit(noResult: true);
  }

  Future<void> upsert(Message m) async {
    final db = await _db.database;
    if (m.id < 0) return;
    await db.insert(
      'messages',
      _toMap(m),
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<List<Message>> getByTicket(int ticketId) async {
    final db = await _db.database;
    final rows = await db.query(
      'messages',
      where: 'ticket_id = ?',
      whereArgs: [ticketId],
      orderBy: 'id ASC',
    );
    return rows.map(_fromMap).toList();
  }

  Future<int> getLastMessageId(int ticketId) async {
    final db = await _db.database;
    final rows = await db.query(
      'messages',
      columns: ['MAX(id) as max_id'],
      where: 'ticket_id = ? AND id > 0',
      whereArgs: [ticketId],
    );
    return (rows.first['max_id'] as int?) ?? 0;
  }

  /// Hapus pesan pending berdasarkan clientMessageId dan simpan versi server.
  Future<void> confirmPending(String clientMessageId, Message serverMessage) async {
    final db = await _db.database;
    await db.delete(
      'messages',
      where: 'client_message_id = ? AND is_pending = 1',
      whereArgs: [clientMessageId],
    );
    await upsert(serverMessage);
  }

  Future<void> deleteByTicket(int ticketId) async {
    final db = await _db.database;
    await db.delete('messages', where: 'ticket_id = ?', whereArgs: [ticketId]);
  }
}
