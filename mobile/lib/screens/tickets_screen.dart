import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/theme.dart';
import '../data/socket/socket_service.dart';
import '../providers/auth_provider.dart';
import '../providers/tickets_provider.dart';
import '../models/ticket.dart';
import '../widgets/connection_banner.dart';
import '../widgets/ticket_item.dart';
import 'ticket_detail_screen.dart';
import 'settings_screen.dart';

/// Layar utama daftar tiket dengan tiga tab.
class TicketsScreen extends StatefulWidget {
  const TicketsScreen({super.key});

  @override
  State<TicketsScreen> createState() => _TicketsScreenState();
}

class _TicketsScreenState extends State<TicketsScreen>
    with SingleTickerProviderStateMixin, WidgetsBindingObserver {
  late final TabController _tabController;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _tabController = TabController(length: 3, vsync: this);
    // Muat cache lalu refresh
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final tp = context.read<TicketsProvider>();
      await tp.loadCached();
      await tp.refresh();
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused) {
      context.read<SocketService>().pause();
    } else if (state == AppLifecycleState.resumed) {
      final auth = context.read<AuthProvider>();
      final socket = context.read<SocketService>();
      socket.resume();
      if (socket.status != SocketStatus.connected) {
        auth.reconnectSocket();
      }
      context.read<TicketsProvider>().refresh();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.read<AuthProvider>();
    final myId = auth.user?.id;
    final tickets = context.watch<TicketsProvider>();

    final queueList = tickets.queue(myId);
    final mineList = tickets.mine(myId);
    final allList = tickets.all();
    final counts = tickets.counts;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Helpdesk'),
        actions: [
          IconButton(
            icon: const Icon(Icons.settings_outlined),
            tooltip: 'Pengaturan',
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const SettingsScreen()),
            ),
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(56),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
            child: Container(
              height: 44,
              padding: const EdgeInsets.all(4),
              decoration: const ShapeDecoration(
                color: AppColors.inkSoft,
                shape: kPill,
              ),
              child: TabBar(
                controller: _tabController,
                tabs: [
                  Tab(
                    height: 36,
                    child: _TabLabel(
                      label: 'Antrean',
                      count: counts['OPEN'] ?? queueList.length,
                    ),
                  ),
                  Tab(
                    height: 36,
                    child: _TabLabel(
                      label: 'Tiket Saya',
                      count: counts['IN_PROGRESS'] ?? mineList.length,
                    ),
                  ),
                  const Tab(height: 36, text: 'Semua'),
                ],
              ),
            ),
          ),
        ),
      ),
      body: Column(
        children: [
          const ConnectionBanner(),
          Expanded(
            child: ColoredBox(
              color: AppColors.bg,
              child: tickets.loading && tickets.tickets.isEmpty
                  ? const Center(child: CircularProgressIndicator())
                  : TabBarView(
                      controller: _tabController,
                      children: [
                        _TicketList(
                            tickets: queueList,
                            emptyMessage: 'Tidak ada tiket dalam antrean'),
                        _TicketList(
                            tickets: mineList,
                            emptyMessage: 'Tidak ada tiket yang ditugaskan'),
                        _TicketList(
                            tickets: allList, emptyMessage: 'Belum ada tiket'),
                      ],
                    ),
            ),
          ),
        ],
      ),
    );
  }
}

class _TabLabel extends StatelessWidget {
  final String label;
  final int count;
  const _TabLabel({required this.label, required this.count});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Flexible(child: Text(label, overflow: TextOverflow.ellipsis)),
        if (count > 0) ...[
          const SizedBox(width: 6),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 1),
            decoration: const ShapeDecoration(
              color: AppColors.green,
              shape: kPill,
            ),
            child: Text(
              '$count',
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: Colors.white,
              ),
            ),
          ),
        ],
      ],
    );
  }
}

class _TicketList extends StatelessWidget {
  final List<Ticket> tickets;
  final String emptyMessage;

  const _TicketList({required this.tickets, required this.emptyMessage});

  @override
  Widget build(BuildContext context) {
    if (tickets.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: const BoxDecoration(
                color: AppColors.chip,
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.inbox_outlined,
                  size: 34, color: AppColors.muted),
            ),
            const SizedBox(height: 14),
            Text(emptyMessage,
                style: const TextStyle(
                    color: AppColors.muted, fontWeight: FontWeight.w500)),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: () => context.read<TicketsProvider>().refresh(),
      color: AppColors.green,
      child: ListView.builder(
        padding: const EdgeInsets.only(top: 10, bottom: 24),
        itemCount: tickets.length,
        itemBuilder: (ctx, i) {
          final t = tickets[i];
          return TicketItem(
            ticket: t,
            onTap: () => Navigator.push(
              ctx,
              MaterialPageRoute(
                builder: (_) => TicketDetailScreen(ticketId: t.id),
              ),
            ),
          );
        },
      ),
    );
  }
}
