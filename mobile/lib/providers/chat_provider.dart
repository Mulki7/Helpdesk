import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:uuid/uuid.dart';
import '../data/db/queue_dao.dart';
import '../data/repositories/message_repository.dart';
import '../data/socket/socket_service.dart';
import '../models/message.dart';
import '../models/pending_message.dart';
import '../../core/config.dart';

/// Provider chat untuk satu tiket aktif.
/// Dibuat ulang setiap kali buka tiket baru.
class ChatProvider extends ChangeNotifier {
  final MessageRepository _repo;
  final SocketService _socket;
  final QueueDao _queueDao;
  final int ticketId;
  final _uuid = const Uuid();
  Timer? _retryTimer;

  ChatProvider({
    required MessageRepository repo,
    required SocketService socket,
    required QueueDao queueDao,
    required this.ticketId,
  })  : _repo = repo,
        _socket = socket,
        _queueDao = queueDao {
    _socket.addMessageListener(_onMessageNew);
    _socket.addConnectedListener(_onSocketConnected);

    // Timer pengiriman ulang tiap 7 detik saat terhubung
    _retryTimer = Timer.periodic(const Duration(seconds: 7), (_) {
      if (_socket.status == SocketStatus.connected) {
        _flushQueue();
      }
    });
  }

  final List<Message> _messages = [];
  bool _loading = false;
  bool _flushing = false;
  String? _error;

  List<Message> get messages => List.unmodifiable(_messages);
  bool get loading => _loading;
  String? get error => _error;

  /// Muat pesan dari cache, lalu sync dari server.
  Future<void> initialize() async {
    _loading = true;
    notifyListeners();

    // 1. Cache dulu (instan)
    final cached = await _repo.getCached(ticketId);
    _messages
      ..clear()
      ..addAll(cached);
    notifyListeners();

    // 2. Sync dari server
    await resync();

    // 3. Tampilkan pending dari antrean
    final pending = await _queueDao.getAll();
    for (final p in pending.where((p) => p.ticketId == ticketId)) {
      final existing = _messages.any(
          (m) => m.clientMessageId == p.clientMessageId && m.isPending);
      if (!existing) {
        _messages.add(Message.pending(
          ticketId: ticketId,
          body: p.body,
          clientMessageId: p.clientMessageId,
        ));
      }
    }

    _loading = false;
    notifyListeners();
  }

  /// Sinkronisasi pesan terbaru dari server.
  Future<void> resync() async {
    try {
      final lastId = await _repo.getLastMessageId(ticketId);
      final fresh = await _repo.fetchAndSync(ticketId,
          after: lastId > 0 ? lastId : null);
      _mergeMessages(fresh);
    } catch (e) {
      _error = 'Gagal sinkronisasi: $e';
    }
  }

  /// Kirim pesan baru.
  Future<void> sendMessage(String body) async {
    if (body.trim().isEmpty) return;

    final clientMessageId = _uuid.v4();
    final pending = Message.pending(
      ticketId: ticketId,
      body: body.trim(),
      clientMessageId: clientMessageId,
    );

    // 1. Tampilkan segera
    _messages.add(pending);
    notifyListeners();

    // 2. Simpan ke antrean SQLite
    await _queueDao.enqueue(PendingMessage(
      clientMessageId: clientMessageId,
      ticketId: ticketId,
      body: body.trim(),
      createdAt: DateTime.now().toUtc(),
    ));

    // 3. Coba kirim via socket
    await _trySend(clientMessageId, ticketId, body.trim());
  }

  Future<void> _trySend(
      String clientMessageId, int ticketId, String body) async {
    if (_socket.status != SocketStatus.connected) return;

    final result = await _socket.sendMessage(
      ticketId: ticketId,
      body: body,
      clientMessageId: clientMessageId,
    );

    if (result['ok'] == true) {
      final serverMsg = Message.fromJson(
          result['message'] as Map<String, dynamic>);
      await _confirmPending(clientMessageId, serverMsg);
    } else {
      final err = result['error']?.toString() ?? '';
      if (err == 'VALIDATION_ERROR' ||
          err == 'FORBIDDEN' ||
          err.contains('FORBIDDEN') ||
          err.contains('INVALID')) {
        await _markFailed(clientMessageId);
      }
    }
  }

  Future<void> _markFailed(String clientMessageId) async {
    await _queueDao.remove(clientMessageId);
    final idx = _messages.indexWhere(
        (m) => m.clientMessageId == clientMessageId && m.isPending);
    if (idx >= 0) {
      _messages[idx] = _messages[idx].copyWith(isPending: false, isFailed: true);
      notifyListeners();
    }
  }

  /// Hapus pesan gagal atau pending.
  Future<void> deletePending(String clientMessageId) async {
    await _queueDao.remove(clientMessageId);
    _messages.removeWhere((m) => m.clientMessageId == clientMessageId);
    notifyListeners();
  }

  Future<void> _confirmPending(
      String clientMessageId, Message serverMsg) async {
    await _queueDao.remove(clientMessageId);
    await _repo.confirmPending(clientMessageId, serverMsg);

    final idx = _messages
        .indexWhere((m) => m.clientMessageId == clientMessageId && m.isPending);
    if (idx >= 0) {
      _messages[idx] = serverMsg;
      notifyListeners();
    }
  }

  void _onMessageNew(Message msg, int tId) {
    if (tId != ticketId) return;
    _mergeMessages([msg]);
  }

  void _onSocketConnected() {
    resync();
    _flushQueue();
  }

  /// Flush antrean pending secara serial (tidak paralel dengan mutex _flushing).
  Future<void> _flushQueue() async {
    if (_flushing) return;
    _flushing = true;
    try {
      final queue = await _queueDao.getAll();
      for (final item in queue.where((p) => p.ticketId == ticketId)) {
        if (_socket.status != SocketStatus.connected) break;
        if (item.retryCount >= AppConfig.maxRetryCount) {
          await _markFailed(item.clientMessageId);
          continue;
        }

        final result = await _socket.sendMessage(
          ticketId: item.ticketId,
          body: item.body,
          clientMessageId: item.clientMessageId,
        );

        if (result['ok'] == true) {
          final serverMsg = Message.fromJson(
              result['message'] as Map<String, dynamic>);
          await _confirmPending(item.clientMessageId, serverMsg);
        } else {
          final err = result['error']?.toString() ?? '';
          if (err == 'VALIDATION_ERROR' ||
              err == 'FORBIDDEN' ||
              err.contains('FORBIDDEN') ||
              err.contains('INVALID')) {
            await _markFailed(item.clientMessageId);
          } else {
            await _queueDao.incrementRetry(item.clientMessageId);
          }
        }
      }
    } finally {
      _flushing = false;
    }
  }

  void _mergeMessages(List<Message> incoming) {
    bool changed = false;
    for (final msg in incoming) {
      // Cek duplikat berdasarkan id ATAU clientMessageId
      final exists = _messages.any((m) =>
          m.id == msg.id ||
          (msg.clientMessageId != null &&
              m.clientMessageId == msg.clientMessageId));
      if (!exists) {
        // Hapus pending dengan clientMessageId yang sama
        _messages.removeWhere((m) =>
            m.isPending && m.clientMessageId == msg.clientMessageId);
        _messages.add(msg);
        changed = true;
      }
    }
    if (changed) {
      _messages.sort((a, b) => a.createdAt.compareTo(b.createdAt));
      notifyListeners();
    }
  }

  @override
  void dispose() {
    _retryTimer?.cancel();
    _socket.removeMessageListener(_onMessageNew);
    _socket.removeConnectedListener(_onSocketConnected);
    super.dispose();
  }
}
