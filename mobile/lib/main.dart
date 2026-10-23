import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'core/theme.dart';
import 'data/repositories/auth_repository.dart';
import 'data/repositories/ticket_repository.dart';
import 'data/services/fcm_service.dart';
import 'data/socket/socket_service.dart';
import 'providers/auth_provider.dart';
import 'providers/connection_provider.dart';
import 'providers/tickets_provider.dart';
import 'screens/login_screen.dart';
import 'screens/tickets_screen.dart';

final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await FcmService.instance.initialize(navigatorKey);
  runApp(const HelpdeskApp());
}

class HelpdeskApp extends StatelessWidget {
  const HelpdeskApp({super.key});

  @override
  Widget build(BuildContext context) {
    // Singleton instances yang dibagikan ke seluruh app
    final authRepo = AuthRepository();
    final socketService = SocketService();

    return MultiProvider(
      providers: [
        ChangeNotifierProvider(
          create: (_) => AuthProvider(repo: authRepo, socket: socketService),
        ),
        ChangeNotifierProvider.value(value: socketService),
        ChangeNotifierProvider(
          create: (_) =>
              ConnectionProvider(socket: socketService),
        ),
        ChangeNotifierProvider(
          create: (_) => TicketsProvider(
            repo: TicketRepository(),
            socket: socketService,
          ),
        ),
      ],
      child: MaterialApp(
        navigatorKey: navigatorKey,
        title: 'Helpdesk',
        theme: buildTheme(),
        debugShowCheckedModeBanner: false,
        home: const _AppRoot(),
      ),
    );
  }
}

/// Root widget yang memilih layar berdasarkan status auth dan memantau lifecycle app.
class _AppRoot extends StatefulWidget {
  const _AppRoot();

  @override
  State<_AppRoot> createState() => _AppRootState();
}

class _AppRootState extends State<_AppRoot> with WidgetsBindingObserver {
  bool _restored = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _restore();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final socket = context.read<SocketService>();
    final auth = context.read<AuthProvider>();

    if (state == AppLifecycleState.paused) {
      // Putuskan socket dengan sengaja saat masuk background agar backend mendeteksi offline
      socket.pause();
    } else if (state == AppLifecycleState.resumed) {
      // Sambungkan kembali saat aplikasi aktif kembali di foreground
      if (auth.status == AuthStatus.authenticated) {
        socket.resume();
        context.read<TicketsProvider>().refresh();
      }
    }
  }

  Future<void> _restore() async {
    await context.read<AuthProvider>().restore();
    setState(() => _restored = true);
  }

  @override
  Widget build(BuildContext context) {
    if (!_restored) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    final authStatus = context.watch<AuthProvider>().status;

    switch (authStatus) {
      case AuthStatus.authenticated:
        return const TicketsScreen();
      case AuthStatus.unauthenticated:
        return const LoginScreen();
      case AuthStatus.unknown:
        return const Scaffold(
          body: Center(child: CircularProgressIndicator()),
        );
    }
  }
}
