import 'package:sqflite/sqflite.dart';
import '../../models/pending_message.dart';
import 'database.dart';

/// DAO untuk tabel pending_queue (antrean offline).
class QueueDao {
  final _db = AppDatabase.instance;

  Future<void> enqueue(PendingMessage msg) async {
    final db = await _db.database;
    await db.insert(
      'pending_queue',
      msg.toMap(),
      conflictAlgorithm: ConflictAlgorithm.ignore,
    );
  }

  Future<List<PendingMessage>> getAll() async {
    final db = await _db.database;
    final rows = await db.query('pending_queue', orderBy: 'created_at ASC');
    return rows.map(PendingMessage.fromMap).toList();
  }

  Future<void> remove(String clientMessageId) async {
    final db = await _db.database;
    await db.delete(
      'pending_queue',
      where: 'client_message_id = ?',
      whereArgs: [clientMessageId],
    );
  }

  Future<void> incrementRetry(String clientMessageId) async {
    final db = await _db.database;
    await db.rawUpdate(
      'UPDATE pending_queue SET retry_count = retry_count + 1 WHERE client_message_id = ?',
      [clientMessageId],
    );
  }

  Future<void> clear() async {
    final db = await _db.database;
    await db.delete('pending_queue');
  }
}
