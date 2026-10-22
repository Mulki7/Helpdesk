// ignore_for_file: constant_identifier_names

/// Konfigurasi aplikasi – semua konstanta global.
class AppConfig {
  AppConfig._();

  /// Server URL default. Bisa di-override via --dart-define SERVER_URL=...
  static const String defaultServerUrl = String.fromEnvironment(
    'SERVER_URL',
    defaultValue: 'http://10.0.2.2:3000',
  );

  /// Timeout ack Socket.IO (ms).
  static const int ackTimeoutMs = 10000;

  /// Batas ukuran pesan (karakter).
  static const int maxMessageLength = 2000;

  /// Batas retry pending queue sebelum ditandai gagal permanen.
  static const int maxRetryCount = 10;
}
