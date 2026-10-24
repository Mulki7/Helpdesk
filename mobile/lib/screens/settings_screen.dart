import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/connection_provider.dart';
import '../data/socket/socket_service.dart';
import '../core/config.dart';
import '../core/theme.dart';

/// Layar Pengaturan: profil, Server URL, status koneksi, logout.
class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  late final TextEditingController _serverCtrl;
  bool _editingUrl = false;

  @override
  void initState() {
    super.initState();
    _serverCtrl = TextEditingController();
    _loadUrl();
  }

  Future<void> _loadUrl() async {
    final url = await context.read<AuthProvider>().getServerUrl();
    setState(() => _serverCtrl.text = url);
  }

  @override
  void dispose() {
    _serverCtrl.dispose();
    super.dispose();
  }

  Future<void> _saveUrl() async {
    await context.read<AuthProvider>().saveServerUrl(_serverCtrl.text.trim());
    setState(() => _editingUrl = false);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Server URL disimpan')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final conn = context.watch<ConnectionProvider>();
    final cs = Theme.of(context).colorScheme;

    final statusColor = conn.status == SocketStatus.connected
        ? AppColors.green
        : conn.status == SocketStatus.connecting
            ? Colors.orange
            : cs.error;

    return Scaffold(
      appBar: AppBar(title: const Text('Pengaturan')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 20, 16, 24),
        children: [
          // Profil
          Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 30,
                    backgroundColor: AppColors.greenSoft,
                    child: Text(
                      auth.user?.name.substring(0, 1).toUpperCase() ?? '?',
                      style: const TextStyle(
                          color: AppColors.greenDark,
                          fontSize: 24,
                          fontWeight: FontWeight.w800),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(auth.user?.name ?? '-',
                            style: Theme.of(context)
                                .textTheme
                                .titleMedium
                                ?.copyWith(
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: -0.3)),
                        const SizedBox(height: 2),
                        Text(auth.user?.email ?? '-',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context)
                                .textTheme
                                .bodySmall
                                ?.copyWith(color: AppColors.muted)),
                        const SizedBox(height: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 3),
                          decoration: ShapeDecoration(
                            color: auth.user?.role == 'ADMIN'
                                ? AppColors.ink
                                : AppColors.greenSoft,
                            shape: kPill,
                          ),
                          child: Text(
                            auth.user?.role == 'ADMIN' ? 'Admin' : 'Agen',
                            style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                color: auth.user?.role == 'ADMIN'
                                    ? Colors.white
                                    : AppColors.greenDark),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          // Status koneksi
          Card(
            child: ListTile(
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 20, vertical: 6),
              leading: Container(
                width: 22,
                height: 22,
                decoration: BoxDecoration(
                  color: statusColor.withAlpha(40),
                  shape: BoxShape.circle,
                ),
                alignment: Alignment.center,
                child: Container(
                  width: 10,
                  height: 10,
                  decoration:
                      BoxDecoration(color: statusColor, shape: BoxShape.circle),
                ),
              ),
              title: const Text('Status Koneksi',
                  style: TextStyle(fontWeight: FontWeight.w700)),
              subtitle: Text(conn.label,
                  style: const TextStyle(color: AppColors.muted)),
            ),
          ),
          const SizedBox(height: 16),
          // Server URL
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Server URL',
                          style: Theme.of(context)
                              .textTheme
                              .titleSmall
                              ?.copyWith(fontWeight: FontWeight.w700)),
                      TextButton(
                        onPressed: () {
                          if (_editingUrl) {
                            _saveUrl();
                          } else {
                            setState(() => _editingUrl = true);
                          }
                        },
                        child: Text(_editingUrl ? 'Simpan' : 'Ubah'),
                      ),
                    ],
                  ),
                  if (_editingUrl)
                    TextField(
                      controller: _serverCtrl,
                      keyboardType: TextInputType.url,
                      decoration: const InputDecoration(
                        hintText: 'http://10.0.2.2:3000',
                      ),
                      onSubmitted: (_) => _saveUrl(),
                    )
                  else
                    Text(
                      _serverCtrl.text.isEmpty
                          ? AppConfig.defaultServerUrl
                          : _serverCtrl.text,
                      style: const TextStyle(
                        color: AppColors.muted,
                        fontFamily: 'monospace',
                        fontSize: 13.5,
                      ),
                    ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),
          // Logout
          ElevatedButton.icon(
            onPressed: () async {
              await context.read<AuthProvider>().logout();
            },
            icon: const Icon(Icons.logout),
            label: const Text('Keluar'),
            style: ElevatedButton.styleFrom(
              backgroundColor: cs.errorContainer,
              foregroundColor: cs.onErrorContainer,
              elevation: 0,
            ),
          ),
        ],
      ),
    );
  }
}
