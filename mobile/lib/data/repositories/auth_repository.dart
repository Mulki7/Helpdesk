import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../api/auth_api.dart';
import '../api/api_client.dart';
import '../../models/user.dart';
import '../../core/config.dart';

/// Repository untuk autentikasi.
class AuthRepository {
  final _api = AuthApi();
  final _storage = const FlutterSecureStorage();

  Future<User> login(String email, String password, String serverUrl) async {
    // Simpan server URL sebelum request
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('server_url', serverUrl);
    ApiClient.instance.invalidate();

    final data = await _api.login(email, password);
    await _storage.write(key: 'access_token', value: data['accessToken']);
    await _storage.write(key: 'refresh_token', value: data['refreshToken']);
    return User.fromJson(data['user'] as Map<String, dynamic>);
  }

  Future<User?> restoreSession() async {
    try {
      return await _api.me();
    } catch (_) {
      return null;
    }
  }

  Future<String?> getAccessToken() {
    return _storage.read(key: 'access_token');
  }

  Future<String?> refreshToken() {
    return ApiClient.instance.refreshToken();
  }

  Future<String?> getRefreshToken() {
    return _storage.read(key: 'refresh_token');
  }

  Future<String> getServerUrl() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('server_url') ?? AppConfig.defaultServerUrl;
  }

  Future<void> saveServerUrl(String url) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('server_url', url);
    ApiClient.instance.invalidate();
  }

  Future<void> logout() async {
    final refreshToken = await _storage.read(key: 'refresh_token');
    if (refreshToken != null) {
      await _api.logout(refreshToken);
    }
    await _storage.delete(key: 'access_token');
    await _storage.delete(key: 'refresh_token');
  }
}
