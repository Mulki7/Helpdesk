import 'package:flutter/foundation.dart';
import '../data/repositories/ticket_repository.dart';
import '../data/socket/socket_service.dart';
import '../models/ticket.dart';
import '../models/message.dart';

/// Provider daftar tiket + real-time update.
class TicketsProvider extends ChangeNotifier {
  final TicketRepository _repo;
  final SocketService _socket;

  TicketsProvider({
    required TicketRepository repo,
    required SocketService socket,
  })  : _repo = repo,
        _socket = socket {
    _socket.addTicketCreatedListener(_onTicketCreated);
    _socket.addTicketUpdatedListener(_onTicketUpdated);
    _socket.addConnectedListener(_onSocketConnected);
    _socket.addMessageListener(_onMessageNew);
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
  Future<void> refresh({bool silent = false}) async {
    if (!silent) {
      _loading = true;
      _error = null;
      notifyListeners();
    }
    try {
      final result = await _repo.fetchTickets();
      _tickets = (result['items'] as List<dynamic>)
          .map((e) => Ticket.fromJson(e as Map<String, dynamic>))
          .toList();
      final rawCounts = result['counts'] as Map<String, dynamic>? ?? {};
      _counts = rawCounts.map((k, v) => MapEntry(k, v as int));
      _error = null;
    } catch (e) {
      if (!silent) {
        _error = 'Gagal memuat tiket: ${e.toString()}';
      }
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  void _onSocketConnected() {
    // Reload tiket saat reconnect
    refresh(silent: true);
  }

  void _onTicketCreated(Ticket t) {
    final idx = _tickets.indexWhere((x) => x.id == t.id);
    if (idx < 0) {
      _tickets = [t, ..._tickets];
    } else {
      _tickets[idx] = t;
    }
    notifyListeners();
    // Sinkronisasi data lengkap & badge jumlah di background
    refresh(silent: true);
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
    refresh(silent: true);
  }

  void _onMessageNew(Message msg, int ticketId) {
    final idx = _tickets.indexWhere((x) => x.id == ticketId);
    if (idx >= 0) {
      final old = _tickets[idx];
      final updated = old.copyWith(
        lastMessage: TicketLastMessage(
          body: msg.body,
          senderType: msg.senderType,
          createdAt: msg.createdAt,
        ),
        updatedAt: msg.createdAt,
      );
      _tickets.removeAt(idx);
      _tickets.insert(0, updated);
      notifyListeners();
    }
    // Refresh diam-diam agar badge & status terupdate
    refresh(silent: true);
  }

  void updateTicketLocally(Ticket t) {
    final idx = _tickets.indexWhere((x) => x.id == t.id);
    if (idx >= 0) {
      _tickets[idx] = t;
      notifyListeners();
    }
  }

  @override
  void dispose() {
    _socket.removeTicketCreatedListener(_onTicketCreated);
    _socket.removeTicketUpdatedListener(_onTicketUpdated);
    _socket.removeConnectedListener(_onSocketConnected);
    _socket.removeMessageListener(_onMessageNew);
    super.dispose();
  }
}
