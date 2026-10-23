// ignore_for_file: deprecated_member_use

import 'dart:convert';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import '../api/api_client.dart';
import '../../screens/ticket_detail_screen.dart';

/// Top-level background message handler for FCM.
/// Must be annotated with @pragma('vm:entry-point') so it can be called from isolate.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // Background message received.
  // Android system displays the notification automatically if notification payload is present.
}

/// Service untuk mengelola FCM push notifications dan local notifications di aplikasi mobile.
class FcmService {
  FcmService._();
  static final FcmService instance = FcmService._();

  bool _initialized = false;
  bool get isInitialized => _initialized;

  final _localNotifications = FlutterLocalNotificationsPlugin();
  GlobalKey<NavigatorState>? _navKey;

  /// Inisialisasi Firebase & FCM.
  /// Jika google-services.json tidak ada atau init gagal, aplikasi tetap jalan normal (no-op).
  Future<void> initialize(GlobalKey<NavigatorState> navKey) async {
    _navKey = navKey;

    try {
      await Firebase.initializeApp();
      _initialized = true;
      debugPrint('[FCM] Firebase initialized successfully.');
    } catch (e) {
      debugPrint('[FCM] Firebase init skipped or failed: $e');
      _initialized = false;
      return;
    }

    try {
      // 1. Setup local notifications channel untuk Android
      const androidChannel = AndroidNotificationChannel(
        'helpdesk_tickets',
        'Tiket Helpdesk',
        description: 'Notifikasi tiket dan pesan Helpdesk',
        importance: Importance.high,
      );

      await _localNotifications
          .resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>()
          ?.createNotificationChannel(androidChannel);

      const initSettings = InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
      );

      await _localNotifications.initialize(
        settings: initSettings,
        onDidReceiveNotificationResponse: (response) {
          if (response.payload != null) {
            _handleNotificationPayload(response.payload!);
          }
        },
      );

      // 2. Setup background handler
      FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

      // 3. Foreground message listener (tampilkan notifikasi lokal)
      FirebaseMessaging.onMessage.listen((RemoteMessage message) {
        _showForegroundNotification(message);
      });

      // 4. Notification tap saat aplikasi di background
      FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
        _handleMessageTap(message);
      });

      // 5. Notification tap saat aplikasi terminated (dibuka dari status mati)
      final initialMessage = await FirebaseMessaging.instance.getInitialMessage();
      if (initialMessage != null) {
        // Tunda sedikit agar root widget dan navigator selesai dipasang
        WidgetsBinding.instance.addPostFrameCallback((_) {
          _handleMessageTap(initialMessage);
        });
      }
    } catch (e) {
      debugPrint('[FCM] Setup notification listeners error: $e');
    }
  }

  /// Tampilkan notifikasi lokal saat aplikasi berada di foreground
  void _showForegroundNotification(RemoteMessage message) {
    final notification = message.notification;
    if (notification == null) return;

    final ticketId = message.data['ticketId']?.toString();
    final payload = jsonEncode({
      'ticketId': ticketId,
      'type': message.data['type'],
    });

    _localNotifications.show(
      id: message.hashCode,
      title: notification.title ?? 'Helpdesk',
      body: notification.body ?? '',
      notificationDetails: const NotificationDetails(
        android: AndroidNotificationDetails(
          'helpdesk_tickets',
          'Tiket Helpdesk',
          channelDescription: 'Notifikasi tiket dan pesan Helpdesk',
          importance: Importance.high,
          priority: Priority.high,
          icon: '@mipmap/ic_launcher',
        ),
      ),
      payload: payload,
    );
  }

  /// Penanganan tap notifikasi dari FCM RemoteMessage
  void _handleMessageTap(RemoteMessage message) {
    final ticketIdStr = message.data['ticketId']?.toString();
    if (ticketIdStr != null) {
      final ticketId = int.tryParse(ticketIdStr);
      _navigateToTicket(ticketId);
    }
  }

  /// Penanganan tap notifikasi dari LocalNotification payload
  void _handleNotificationPayload(String payloadStr) {
    try {
      final map = jsonDecode(payloadStr) as Map<String, dynamic>;
      final ticketIdStr = map['ticketId']?.toString();
      if (ticketIdStr != null) {
        final ticketId = int.tryParse(ticketIdStr);
        _navigateToTicket(ticketId);
      }
    } catch (e) {
      debugPrint('[FCM] Parse notification payload error: $e');
    }
  }

  /// Buka layar chat tiket dengan aman
  void _navigateToTicket(int? ticketId) {
    if (ticketId == null) return;
    final navState = _navKey?.currentState;
    if (navState == null) return;

    try {
      navState.push(
        MaterialPageRoute(
          builder: (_) => TicketDetailScreen(ticketId: ticketId),
        ),
      );
    } catch (e) {
      debugPrint('[FCM] Navigation to ticket error: $e');
    }
  }

  /// Minta izin notifikasi (Android 13+), ambil token FCM, kirim ke POST /api/devices,
  /// dan dengarkan onTokenRefresh.
  Future<void> registerDeviceToken() async {
    if (!_initialized) return;

    try {
      final settings = await FirebaseMessaging.instance.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );

      if (settings.authorizationStatus == AuthorizationStatus.denied) {
        debugPrint('[FCM] Notification permission was denied by user.');
        return;
      }

      final token = await FirebaseMessaging.instance.getToken();
      if (token != null) {
        await _sendTokenToServer(token);
      }

      // Dengarkan pergantian token FCM
      FirebaseMessaging.instance.onTokenRefresh.listen((newToken) {
        _sendTokenToServer(newToken);
      });
    } catch (e) {
      debugPrint('[FCM] Register device token error: $e');
    }
  }

  /// Kirim token FCM ke backend POST /api/devices
  Future<void> _sendTokenToServer(String token) async {
    try {
      final dio = await ApiClient.instance.dio;
      await dio.post('/devices', data: {
        'token': token,
        'platform': 'android',
      });
      debugPrint('[FCM] Token perangkat berhasil didaftarkan ke server.');
    } catch (e) {
      debugPrint('[FCM] Gagal mengirim token ke server: $e');
    }
  }

  /// Hapus token FCM di server (DELETE /api/devices) dan hapus token FCM lokal saat logout.
  Future<void> unregisterDeviceToken() async {
    if (!_initialized) return;

    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token != null) {
        try {
          final dio = await ApiClient.instance.dio;
          await dio.delete('/devices', data: {'token': token});
          debugPrint('[FCM] Token perangkat berhasil dihapus dari server.');
        } catch (e) {
          debugPrint('[FCM] Gagal menghapus token di server: $e');
        }
      }
      await FirebaseMessaging.instance.deleteToken();
      debugPrint('[FCM] Token FCM lokal berhasil dihapus.');
    } catch (e) {
      debugPrint('[FCM] Unregister device token error: $e');
    }
  }
}
