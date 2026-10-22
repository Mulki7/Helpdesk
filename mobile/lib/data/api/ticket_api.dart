import '../../models/message.dart';
import '../../models/ticket.dart';
import 'api_client.dart';

/// REST calls untuk Tiket dan Pesan.
class TicketApi {
  final _client = ApiClient.instance;

  Future<Map<String, dynamic>> getTickets({
    String? status,
    String? assigned,
    String? q,
    int page = 1,
    int limit = 50,
  }) async {
    final dio = await _client.dio;
    final resp = await dio.get('/tickets', queryParameters: {
      if (status != null) 'status': status,
      if (assigned != null) 'assigned': assigned,
      if (q != null && q.isNotEmpty) 'q': q,
      'page': page,
      'limit': limit,
    });
    return resp.data['data'] as Map<String, dynamic>;
  }

  Future<Ticket> getTicket(int id) async {
    final dio = await _client.dio;
    final resp = await dio.get('/tickets/$id');
    return Ticket.fromJson(resp.data['data'] as Map<String, dynamic>);
  }

  Future<List<Message>> getMessages(int ticketId, {int? after}) async {
    final dio = await _client.dio;
    final resp = await dio.get(
      '/tickets/$ticketId/messages',
      queryParameters: {
        if (after != null) 'after': after,
        'limit': 100,
      },
    );
    final list = resp.data['data'] as List<dynamic>;
    return list
        .map((e) => Message.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<Ticket> claim(int ticketId) async {
    final dio = await _client.dio;
    final resp = await dio.post('/tickets/$ticketId/claim');
    return Ticket.fromJson(resp.data['data'] as Map<String, dynamic>);
  }

  Future<Ticket> release(int ticketId) async {
    final dio = await _client.dio;
    final resp = await dio.post('/tickets/$ticketId/release');
    return Ticket.fromJson(resp.data['data'] as Map<String, dynamic>);
  }

  Future<Ticket> patch(int ticketId, {String? status, String? priority}) async {
    final dio = await _client.dio;
    final resp = await dio.patch('/tickets/$ticketId', data: {
      if (status != null) 'status': status,
      if (priority != null) 'priority': priority,
    });
    return Ticket.fromJson(resp.data['data'] as Map<String, dynamic>);
  }
}
