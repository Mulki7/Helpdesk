import 'package:path/path.dart';
import 'package:sqflite/sqflite.dart';

/// Helper singleton untuk SQLite.
class AppDatabase {
  AppDatabase._();
  static final AppDatabase instance = AppDatabase._();

  Database? _db;

  Future<Database> get database async {
    _db ??= await _open();
    return _db!;
  }

  Future<Database> _open() async {
    final dbPath = await getDatabasesPath();
    final path = join(dbPath, 'helpdesk.db');
    return openDatabase(
      path,
      version: 1,
      onCreate: _onCreate,
    );
  }

  Future<void> _onCreate(Database db, int version) async {
    await db.execute('''
      CREATE TABLE tickets (
        id INTEGER PRIMARY KEY,
        number TEXT NOT NULL,
        subject TEXT NOT NULL,
        status TEXT NOT NULL,
        priority TEXT NOT NULL,
        customer_id INTEGER NOT NULL,
        customer_name TEXT NOT NULL,
        customer_email TEXT,
        assigned_agent_id INTEGER,
        assigned_agent_name TEXT,
        last_message_body TEXT,
        last_message_sender_type TEXT,
        last_message_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    ''');

    await db.execute('''
      CREATE TABLE messages (
        id INTEGER PRIMARY KEY,
        ticket_id INTEGER NOT NULL,
        sender_type TEXT NOT NULL,
        sender_name TEXT,
        body TEXT NOT NULL,
        client_message_id TEXT,
        created_at TEXT NOT NULL,
        is_pending INTEGER NOT NULL DEFAULT 0
      )
    ''');

    await db.execute('''
      CREATE TABLE pending_queue (
        client_message_id TEXT PRIMARY KEY,
        ticket_id INTEGER NOT NULL,
        body TEXT NOT NULL,
        created_at TEXT NOT NULL,
        retry_count INTEGER NOT NULL DEFAULT 0
      )
    ''');

    await db.execute(
        'CREATE INDEX idx_messages_ticket ON messages(ticket_id, id)');
    await db.execute(
        'CREATE INDEX idx_tickets_updated ON tickets(updated_at DESC)');
  }

  Future<void> clearAll() async {
    final db = await database;
    await db.delete('tickets');
    await db.delete('messages');
    await db.delete('pending_queue');
  }

  Future<void> close() async {
    await _db?.close();
    _db = null;
  }
}
