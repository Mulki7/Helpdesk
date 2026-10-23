import 'package:flutter/foundation.dart';
import '../data/socket/socket_service.dart';

/// Provider yang memirror status koneksi dari SocketService.
/// Dipisah agar widget yang hanya butuh status tidak rebuild saat tiket berubah.
class ConnectionProvider extends ChangeNotifier {
  final SocketService _socket;

  ConnectionProvider({required SocketService socket}) : _socket = socket {
    _socket.addListener(_onSocketChange);
  }

  SocketStatus get status => _socket.status;

  String get label {
    switch (_socket.status) {
      case SocketStatus.connected:
        return 'Terhubung';
      case SocketStatus.connecting:
        return 'Menyambungkan ulang...';
      case SocketStatus.disconnected:
        return 'Offline';
    }
  }

  void _onSocketChange() {
    notifyListeners();
  }

  void reconnect() {
    _socket.reconnect(force: true);
  }

  @override
  void dispose() {
    _socket.removeListener(_onSocketChange);
    super.dispose();
  }
}
