import 'package:flutter/foundation.dart';
import '../data/repositories/ticket_repository.dart';
import '../data/socket/socket_service.dart';
import '../models/ticket.dart';

/// Provider daftar tiket + real-time update.
class TicketsProvider extends ChangeNotifier {
  final TicketRepository _repo;
  final SocketService _socket;

  TicketsProvider({
    required TicketRepository repo,
    required SocketService socket,
  })  : _repo = repo,
        _socket = socket {
    _socket.onTicketCreated = _onTicketCreated;
    _socket.onTicketUpdated = _onTicketUpdated;
    _socket.onConnected = _onSocketConnected;
  }

  List<Ticket> _tickets = [];
  Map<String, int> _counts = {};
  bool _loading = false;
  String? _error;

  List<Ticket> get tickets => _tickets;
  Map<String, int> get counts => _counts;
  bool get loading => _loading;
  String? get error => _error;

  // Tiket yang difilter per tab
  List<Ticket> queue(int? myUserId) => _tickets
      .where((t) => t.status == 'OPEN' && t.assignedAgent == null)
      .toList();

  List<Ticket> mine(int? myUserId) => myUserId == null
      ? []
      : _tickets
          .where((t) => t.assignedAgent?.id == myUserId)
          .toList();

  List<Ticket> all() => _tickets;

  /// Muat dari cache SQLite (tampil instan offline).
  Future<void> loadCached() async {
    _tickets = await _repo.getCachedTickets();
    notifyListeners();
  }

  /// Refresh dari API.
  Future<void> refresh() async {
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      final result = await _repo.fetchTickets();
      _tickets = (result['items'] as List<dynamic>)
          .map((e) => Ticket.fromJson(e as Map<String, dynamic>))
          .toList();
      final rawCounts = result['counts'] as Map<String, dynamic>? ?? {};
      _counts = rawCounts.map((k, v) => MapEntry(k, v as int));
    } catch (e) {
      _error = 'Gagal memuat tiket: ${e.toString()}';
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  void _onSocketConnected() {
    // Reload tiket saat reconnect
    refresh();
  }

  void _onTicketCreated(Ticket t) {
    final idx = _tickets.indexWhere((x) => x.id == t.id);
    if (idx < 0) {
      _tickets = [t, ..._tickets];
    } else {
      _tickets[idx] = t;
    }
    notifyListeners();
  }

  void _onTicketUpdated(Ticket t) {
    final idx = _tickets.indexWhere((x) => x.id == t.id);
    if (idx >= 0) {
      _tickets[idx] = t;
      notifyListeners();
    } else {
      _tickets = [t, ..._tickets];
      notifyListeners();
    }
  }

  void updateTicketLocally(Ticket t) {
    final idx = _tickets.indexWhere((x) => x.id == t.id);
    if (idx >= 0) {
      _tickets[idx] = t;
      notifyListeners();
    }
  }
}
