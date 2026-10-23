import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import '../../core/config.dart';
import '../../models/message.dart';
import '../../models/ticket.dart';

enum SocketStatus { connected, connecting, disconnected }

typedef MessageNewCallback = void Function(Message message, int ticketId);
typedef TicketCreatedCallback = void Function(Ticket ticket);
typedef TicketUpdatedCallback = void Function(Ticket ticket);
typedef ConnectCallback = void Function();

/// Service Socket.IO untuk staff (agent/admin).
class SocketService extends ChangeNotifier {
  io.Socket? _socket;
  SocketStatus _status = SocketStatus.disconnected;

  SocketStatus get status => _status;

  final List<MessageNewCallback> _messageNewListeners = [];
  final List<TicketCreatedCallback> _ticketCreatedListeners = [];
  final List<TicketUpdatedCallback> _ticketUpdatedListeners = [];
  final List<ConnectCallback> _connectedListeners = [];
  Future<String?> Function()? onTokenExpired;

  void addMessageListener(MessageNewCallback cb) => _messageNewListeners.add(cb);
  void removeMessageListener(MessageNewCallback cb) => _messageNewListeners.remove(cb);

  void addTicketCreatedListener(TicketCreatedCallback cb) => _ticketCreatedListeners.add(cb);
  void removeTicketCreatedListener(TicketCreatedCallback cb) => _ticketCreatedListeners.remove(cb);

  void addTicketUpdatedListener(TicketUpdatedCallback cb) => _ticketUpdatedListeners.add(cb);
  void removeTicketUpdatedListener(TicketUpdatedCallback cb) => _ticketUpdatedListeners.remove(cb);

  void addConnectedListener(ConnectCallback cb) => _connectedListeners.add(cb);
  void removeConnectedListener(ConnectCallback cb) => _connectedListeners.remove(cb);

  set onMessageNew(MessageNewCallback? cb) {
    if (cb != null) addMessageListener(cb);
  }
  set onTicketCreated(TicketCreatedCallback? cb) {
    if (cb != null) addTicketCreatedListener(cb);
  }
  set onTicketUpdated(TicketUpdatedCallback? cb) {
    if (cb != null) addTicketUpdatedListener(cb);
  }
  set onConnected(ConnectCallback? cb) {
    if (cb != null) addConnectedListener(cb);
  }

  String? _accessToken;
  Timer? _watchdogTimer;
  int _unconnectedTicks = 0;
  bool _isPaused = false;
  bool get isPaused => _isPaused;

  Future<void> connect(String accessToken) async {
    _isPaused = false;
    _accessToken = accessToken;
    final prefs = await SharedPreferences.getInstance();
    final serverUrl =
        prefs.getString('server_url') ?? AppConfig.defaultServerUrl;

    _socket?.dispose();

    _setStatus(SocketStatus.connecting);

    _socket = io.io(
      serverUrl,
      io.OptionBuilder()
          .setTransports(['websocket', 'polling'])
          .setAuth({'token': accessToken})
          .enableAutoConnect()
          .enableReconnection()
          .setReconnectionAttempts(999999)
          .setReconnectionDelay(500)
          .setReconnectionDelayMax(1500)
          .build(),
    );

    void handleConnected() {
      _setStatus(SocketStatus.connected);
      _unconnectedTicks = 0;
      for (final cb in List.of(_connectedListeners)) {
        cb();
      }
    }

    _socket!.onConnect((_) => handleConnected());
    _socket!.on('reconnect', (_) => handleConnected());

    _socket!.onDisconnect((_) {
      _setStatus(SocketStatus.disconnected);
    });

    _socket!.onReconnecting((_) {
      _setStatus(SocketStatus.connecting);
    });

    _socket!.onConnectError((data) async {
      debugPrint('[Socket] connect_error: $data');
      _setStatus(SocketStatus.disconnected);
      final str = data.toString().toLowerCase();
      if (str.contains('token') || str.contains('unauthorized') || str.contains('jwt')) {
        final newToken = await onTokenExpired?.call();
        if (newToken != null) {
          connect(newToken);
        }
      }
    });

    _socket!.on('message:new', (data) {
      try {
        final map = data as Map<String, dynamic>;
        final msg = Message.fromJson(map['message'] as Map<String, dynamic>);
        final ticketId = map['ticketId'] as int;
        for (final cb in List.of(_messageNewListeners)) {
          cb(msg, ticketId);
        }
      } catch (e) {
        debugPrint('[Socket] message:new parse error: $e');
      }
    });

    _socket!.on('ticket:created', (data) {
      try {
        final ticket = Ticket.fromJson(data as Map<String, dynamic>);
        for (final cb in List.of(_ticketCreatedListeners)) {
          cb(ticket);
        }
      } catch (e) {
        debugPrint('[Socket] ticket:created parse error: $e');
      }
    });

    _socket!.on('ticket:updated', (data) {
      try {
        final ticket = Ticket.fromJson(data as Map<String, dynamic>);
        for (final cb in List.of(_ticketUpdatedListeners)) {
          cb(ticket);
        }
      } catch (e) {
        debugPrint('[Socket] ticket:updated parse error: $e');
      }
    });

    _startWatchdog();
  }

  void _startWatchdog() {
    _watchdogTimer?.cancel();
    if (_isPaused) return;

    _watchdogTimer = Timer.periodic(const Duration(seconds: 2), (_) {
      if (_isPaused) {
        _watchdogTimer?.cancel();
        return;
      }
      if (_status != SocketStatus.connected && _accessToken != null) {
        _unconnectedTicks++;
        if (_unconnectedTicks >= 2) {
          _unconnectedTicks = 0;
          debugPrint('[Socket] Watchdog: cycling socket connection...');
          connect(_accessToken!);
        } else {
          _socket?.connect();
        }
      } else {
        _unconnectedTicks = 0;
      }
    });
  }

  /// Putuskan socket saat aplikasi masuk background (paused)
  /// agar backend mendeteksi staff sebagai offline dan push notification (FCM) bisa masuk.
  void pause() {
    _isPaused = true;
    _watchdogTimer?.cancel();
    _watchdogTimer = null;
    try {
      _socket?.disconnect();
    } catch (_) {}
    _setStatus(SocketStatus.disconnected);
    debugPrint('[Socket] Paused: socket disconnected & watchdog stopped for background mode.');
  }

  /// Sambungkan kembali socket saat aplikasi kembali ke foreground (resumed).
  void resume() {
    if (!_isPaused && _status == SocketStatus.connected) return;
    _isPaused = false;
    debugPrint('[Socket] Resumed: reconnecting socket and restarting watchdog...');
    if (_accessToken != null) {
      connect(_accessToken!);
    }
  }

  void reconnect({bool force = false}) {
    if (_isPaused) return;
    if (_accessToken == null) return;
    if (force || _status != SocketStatus.connected) {
      connect(_accessToken!);
    }
  }

  /// Emit sync:request untuk mendapatkan pesan terbaru.
  /// [openTickets] = list {ticketId, lastMessageId}
  Future<List<Message>> syncMessages(
      List<Map<String, dynamic>> openTickets) async {
    if (_socket == null || _status != SocketStatus.connected) return [];

    final completer = Completer<List<Message>>();
    _socket!.emitWithAck(
      'sync:request',
      {'tickets': openTickets},
      ack: (data) {
        try {
          final resp = data as Map<String, dynamic>;
          if (resp['ok'] == true) {
            final list = (resp['messages'] as List<dynamic>)
                .map((e) => Message.fromJson(e as Map<String, dynamic>))
                .toList();
            completer.complete(list);
          } else {
            completer.complete([]);
          }
        } catch (_) {
          completer.complete([]);
        }
      },
    );

    return completer.future.timeout(
      const Duration(seconds: 10),
      onTimeout: () => [],
    );
  }

  /// Kirim pesan via socket, kembalikan ack.
  Future<Map<String, dynamic>> sendMessage({
    required int ticketId,
    required String body,
    required String clientMessageId,
  }) async {
    if (_socket == null || _status != SocketStatus.connected) {
      return {'ok': false, 'error': 'not_connected'};
    }

    final completer = Completer<Map<String, dynamic>>();

    _socket!.emitWithAck(
      'message:send',
      {
        'ticketId': ticketId,
        'body': body,
        'clientMessageId': clientMessageId,
      },
      ack: (data) {
        try {
          completer.complete(data as Map<String, dynamic>);
        } catch (_) {
          completer.complete({'ok': false, 'error': 'parse_error'});
        }
      },
    );

    return completer.future.timeout(
      const Duration(milliseconds: AppConfig.ackTimeoutMs),
      onTimeout: () => {'ok': false, 'error': 'timeout'},
    );
  }

  void disconnect() {
    _watchdogTimer?.cancel();
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
    _accessToken = null;
    _setStatus(SocketStatus.disconnected);
  }

  void _setStatus(SocketStatus s) {
    if (_status == s) return;
    _status = s;
    notifyListeners();
  }

  @override
  void dispose() {
    disconnect();
    super.dispose();
  }
}
