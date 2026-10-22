import 'package:dio/dio.dart';
import '../../models/user.dart';
import 'api_client.dart';

/// REST calls untuk Auth.
class AuthApi {
  final _client = ApiClient.instance;

  Future<Map<String, dynamic>> login(String email, String password) async {
    final dio = await _client.dio;
    final resp = await dio.post('/auth/login', data: {
      'email': email,
      'password': password,
    });
    return resp.data['data'] as Map<String, dynamic>;
  }

  Future<User> me() async {
    final dio = await _client.dio;
    final resp = await dio.get('/auth/me');
    return User.fromJson(resp.data['data'] as Map<String, dynamic>);
  }

  Future<void> logout(String refreshToken) async {
    try {
      final dio = await _client.dio;
      await dio.post('/auth/logout', data: {'refreshToken': refreshToken});
    } on DioException catch (_) {
      // abaikan error saat logout
    }
  }
}
