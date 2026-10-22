import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../core/config.dart';

/// Singleton Dio dengan interceptor auth + refresh token.
class ApiClient {
  ApiClient._();
  static final ApiClient instance = ApiClient._();

  Dio? _dio;
  final _storage = const FlutterSecureStorage();

  /// Getter – inisialisasi ulang jika belum ada atau base URL berubah.
  Future<Dio> get dio async {
    final prefs = await SharedPreferences.getInstance();
    final baseUrl =
        prefs.getString('server_url') ?? AppConfig.defaultServerUrl;

    if (_dio == null || _dio!.options.baseUrl != '$baseUrl/api') {
      _dio = _buildDio('$baseUrl/api');
    }
    return _dio!;
  }

  Dio _buildDio(String baseUrl) {
    final dio = Dio(BaseOptions(
      baseUrl: baseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 10),
      headers: {'Content-Type': 'application/json'},
    ));

    dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await _storage.read(key: 'access_token');
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        return handler.next(options);
      },
      onError: (error, handler) async {
        final response = error.response;
        if (response?.statusCode == 401) {
          // Coba refresh token
          try {
            final refreshed = await _doRefresh(dio);
            if (refreshed) {
              // Ulangi request asli dengan token baru
              final token = await _storage.read(key: 'access_token');
              final opts = error.requestOptions;
              opts.headers['Authorization'] = 'Bearer $token';
              final retryResponse = await dio.fetch(opts);
              return handler.resolve(retryResponse);
            }
          } catch (_) {
            // refresh gagal – paksa logout ditangani di provider
          }
        }
        return handler.next(error);
      },
    ));

    return dio;
  }

  Future<bool> _doRefresh(Dio dio) async {
    final refreshToken = await _storage.read(key: 'refresh_token');
    if (refreshToken == null) return false;

    final prefs = await SharedPreferences.getInstance();
    final baseUrl =
        prefs.getString('server_url') ?? AppConfig.defaultServerUrl;

    final resp = await Dio().post(
      '$baseUrl/api/auth/refresh',
      data: {'refreshToken': refreshToken},
    );
    final data = resp.data['data'];
    await _storage.write(key: 'access_token', value: data['accessToken']);
    await _storage.write(key: 'refresh_token', value: data['refreshToken']);
    return true;
  }

  Future<String?> refreshToken() async {
    final refreshToken = await _storage.read(key: 'refresh_token');
    if (refreshToken == null) return null;

    final prefs = await SharedPreferences.getInstance();
    final baseUrl =
        prefs.getString('server_url') ?? AppConfig.defaultServerUrl;

    try {
      final resp = await Dio().post(
        '$baseUrl/api/auth/refresh',
        data: {'refreshToken': refreshToken},
      );
      final data = resp.data['data'];
      final newAccessToken = data['accessToken'] as String;
      await _storage.write(key: 'access_token', value: newAccessToken);
      await _storage.write(key: 'refresh_token', value: data['refreshToken'] as String);
      return newAccessToken;
    } catch (_) {
      return null;
    }
  }

  void invalidate() {
    _dio = null;
  }
}
