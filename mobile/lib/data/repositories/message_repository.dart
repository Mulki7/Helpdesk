import '../../models/message.dart';
import '../api/ticket_api.dart';
import '../db/message_dao.dart';

/// Repository pesan – koordinasikan API dan SQLite cache.
class MessageRepository {
  final _api = TicketApi();
  final _dao = MessageDao();

  /// Muat pesan dari cache (cepat), setelah itu sync dari API.
  Future<List<Message>> getCached(int ticketId) => _dao.getByTicket(ticketId);

  Future<List<Message>> fetchAndSync(int ticketId, {int? after}) async {
    final messages = await _api.getMessages(ticketId, after: after);
    await _dao.upsertAll(messages);
    return messages;
  }

  Future<int> getLastMessageId(int ticketId) =>
      _dao.getLastMessageId(ticketId);

  Future<void> savePending(Message msg) async {
    // Simpan pesan pending ke db untuk ditampilkan di UI
    // id < 0 tidak disimpan ke tabel messages (lihat MessageDao)
  }

  Future<void> confirmPending(
      String clientMessageId, Message serverMessage) async {
    await _dao.confirmPending(clientMessageId, serverMessage);
  }

  Future<void> saveFromSocket(Message msg) async {
    await _dao.upsert(msg);
  }
}
