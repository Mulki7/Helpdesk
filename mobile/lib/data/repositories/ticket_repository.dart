import '../../models/ticket.dart';
import '../api/ticket_api.dart';
import '../db/ticket_dao.dart';

/// Repository tiket – koordinasikan API dan SQLite cache.
class TicketRepository {
  final _api = TicketApi();
  final _dao = TicketDao();

  /// Ambil tiket dari API, cache ke SQLite, kembalikan hasilnya.
  Future<Map<String, dynamic>> fetchTickets({
    String? status,
    String? assigned,
    String? q,
    int page = 1,
  }) async {
    final result = await _api.getTickets(
      status: status,
      assigned: assigned,
      q: q,
      page: page,
    );
    final items = (result['items'] as List<dynamic>)
        .map((e) => Ticket.fromJson(e as Map<String, dynamic>))
        .toList();
    if (page == 1) await _dao.upsertAll(items);
    return result;
  }

  Future<List<Ticket>> getCachedTickets() => _dao.getAll();

  Future<Ticket> fetchTicket(int id) async {
    final t = await _api.getTicket(id);
    await _dao.upsert(t);
    return t;
  }

  Future<Ticket> claim(int ticketId) async {
    final t = await _api.claim(ticketId);
    await _dao.upsert(t);
    return t;
  }

  Future<Ticket> release(int ticketId) async {
    final t = await _api.release(ticketId);
    await _dao.upsert(t);
    return t;
  }

  Future<Ticket> patch(int ticketId,
      {String? status, String? priority}) async {
    final t = await _api.patch(ticketId, status: status, priority: priority);
    await _dao.upsert(t);
    return t;
  }
}
