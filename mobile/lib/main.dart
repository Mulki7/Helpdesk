import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'core/theme.dart';
import 'data/repositories/auth_repository.dart';
import 'data/repositories/ticket_repository.dart';
import 'data/socket/socket_service.dart';
import 'providers/auth_provider.dart';
import 'providers/connection_provider.dart';
import 'providers/tickets_provider.dart';
import 'screens/login_screen.dart';
import 'screens/tickets_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
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
        title: 'Helpdesk',
        theme: buildTheme(),
        debugShowCheckedModeBanner: false,
        home: const _AppRoot(),
      ),
    );
  }
}

/// Root widget yang memilih layar berdasarkan status auth.
class _AppRoot extends StatefulWidget {
  const _AppRoot();

  @override
  State<_AppRoot> createState() => _AppRootState();
}

class _AppRootState extends State<_AppRoot> {
  bool _restored = false;

  @override
  void initState() {
    super.initState();
    _restore();
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
