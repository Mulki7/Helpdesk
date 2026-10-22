import 'package:flutter/foundation.dart';
import '../data/db/database.dart';
import '../data/repositories/auth_repository.dart';
import '../data/socket/socket_service.dart';
import '../models/user.dart';

enum AuthStatus { unknown, authenticated, unauthenticated }

/// Provider untuk state autentikasi.
class AuthProvider extends ChangeNotifier {
  final AuthRepository _repo;
  final SocketService _socket;

  AuthProvider({required AuthRepository repo, required SocketService socket})
      : _repo = repo,
        _socket = socket {
    _socket.onTokenExpired = _refreshToken;
  }

  AuthStatus _status = AuthStatus.unknown;
  User? _user;
  String? _errorMessage;
  bool _loading = false;

  AuthStatus get status => _status;
  User? get user => _user;
  String? get errorMessage => _errorMessage;
  bool get loading => _loading;
  bool get isAdmin => _user?.isAdmin ?? false;

  Future<String?> _refreshToken() async {
    final newToken = await _repo.refreshToken();
    if (newToken == null) {
      await logout();
    }
    return newToken;
  }

  /// Panggil saat app start untuk memulihkan sesi.
  Future<void> restore() async {
    final user = await _repo.restoreSession();
    if (user != null) {
      _user = user;
      _status = AuthStatus.authenticated;
      // Sambungkan socket
      final token = await _repo.getAccessToken();
      if (token != null) await _socket.connect(token);
    } else {
      _status = AuthStatus.unauthenticated;
    }
    notifyListeners();
  }

  Future<void> login(String email, String password, String serverUrl) async {
    _loading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      _user = await _repo.login(email, password, serverUrl);
      _status = AuthStatus.authenticated;
      final token = await _repo.getAccessToken();
      if (token != null) await _socket.connect(token);
    } catch (e) {
      _errorMessage = _parseError(e);
      _status = AuthStatus.unauthenticated;
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<void> logout() async {
    _socket.disconnect();
    await _repo.logout();
    await AppDatabase.instance.clearAll();
    _user = null;
    _status = AuthStatus.unauthenticated;
    notifyListeners();
  }

  Future<String> getServerUrl() => _repo.getServerUrl();

  Future<void> saveServerUrl(String url) async {
    _socket.disconnect();
    await AppDatabase.instance.clearAll();
    await _repo.saveServerUrl(url);
    // Reconnect socket jika sudah login
    if (_status == AuthStatus.authenticated) {
      final token = await _repo.getAccessToken();
      if (token != null) await _socket.connect(token);
    }
    notifyListeners();
  }

  Future<void> reconnectSocket() async {
    if (_status == AuthStatus.authenticated) {
      final token = await _repo.getAccessToken();
      if (token != null) await _socket.connect(token);
    }
  }

  String _parseError(dynamic e) {
    final msg = e.toString();
    if (msg.contains('401') || msg.contains('INVALID_CREDENTIALS')) {
      return 'Email atau password salah.';
    }
    if (msg.contains('SocketException') || msg.contains('Connection')) {
      return 'Tidak dapat terhubung ke server. Periksa URL server.';
    }
    return 'Terjadi kesalahan. Silakan coba lagi.';
  }
}
