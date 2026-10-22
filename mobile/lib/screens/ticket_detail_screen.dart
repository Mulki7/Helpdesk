import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../data/db/queue_dao.dart';
import '../data/repositories/message_repository.dart';
import '../data/socket/socket_service.dart';
import '../providers/auth_provider.dart';
import '../providers/chat_provider.dart';
import '../providers/tickets_provider.dart';
import '../data/repositories/ticket_repository.dart';
import '../models/ticket.dart';
import '../widgets/connection_banner.dart';
import '../widgets/message_bubble.dart';
import '../widgets/priority_badge.dart';

/// Layar detail tiket: header, chat, aksi tiket, input balasan.
class TicketDetailScreen extends StatefulWidget {
  final int ticketId;
  const TicketDetailScreen({super.key, required this.ticketId});

  @override
  State<TicketDetailScreen> createState() => _TicketDetailScreenState();
}

class _TicketDetailScreenState extends State<TicketDetailScreen>
    with WidgetsBindingObserver {
  late final ChatProvider _chatProvider;
  final _inputCtrl = TextEditingController();
  final _scrollCtrl = ScrollController();
  Ticket? _ticket;
  bool _loadingTicket = false;
  bool _actionLoading = false;
  String? _actionError;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _chatProvider = ChatProvider(
      repo: MessageRepository(),
      socket: context.read<SocketService>(),
      queueDao: QueueDao(),
      ticketId: widget.ticketId,
    );
    _loadTicket();
    _chatProvider.initialize().then((_) => _scrollToBottom());
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      final auth = context.read<AuthProvider>();
      final socket = context.read<SocketService>();
      if (socket.status != SocketStatus.connected) {
        auth.reconnectSocket();
      }
      _loadTicket();
      _chatProvider.resync();
    }
  }

  Future<void> _loadTicket() async {
    setState(() => _loadingTicket = true);
    try {
      final t = await TicketRepository().fetchTicket(widget.ticketId);
      setState(() => _ticket = t);
    } catch (e) {
      setState(() => _actionError = e.toString());
    } finally {
      setState(() => _loadingTicket = false);
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollCtrl.hasClients) {
        _scrollCtrl.animateTo(
          _scrollCtrl.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _chatProvider.dispose();
    _inputCtrl.dispose();
    _scrollCtrl.dispose();
    super.dispose();
  }

  Future<void> _doAction(Future<Ticket> Function() action) async {
    setState(() {
      _actionLoading = true;
      _actionError = null;
    });
    try {
      final updated = await action();
      if (!mounted) return;
      setState(() => _ticket = updated);
      context.read<TicketsProvider>().updateTicketLocally(updated);
    } catch (e) {
      final msg = e.toString();
      setState(() => _actionError = msg.contains('409')
          ? 'Tiket sudah diambil agen lain.'
          : 'Gagal: $msg');
    } finally {
      setState(() => _actionLoading = false);
    }
  }

  bool _canReply(Ticket? t, AuthProvider auth) {
    if (t == null) return false;
    if (t.status == 'CLOSED') return false;
    if (auth.isAdmin) return true;
    return t.assignedAgent?.id == auth.user?.id;
  }

  String _replyHint(Ticket? t, AuthProvider auth) {
    if (t == null) return '';
    if (t.status == 'CLOSED') return 'Tiket sudah ditutup';
    if (t.status == 'OPEN' && t.assignedAgent == null) {
      return 'Ambil tiket terlebih dahulu untuk membalas';
    }
    if (!auth.isAdmin && t.assignedAgent?.id != auth.user?.id) {
      return 'Hanya assignee atau admin yang dapat membalas';
    }
    return 'Ketik balasan...';
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final t = _ticket;
    final cs = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(t?.number ?? 'Tiket', style: const TextStyle(fontSize: 16)),
            if (t != null)
              Text(
                t.customer.name,
                style: const TextStyle(fontSize: 12),
              ),
          ],
        ),
        actions: [
          if (_actionLoading)
            const Padding(
              padding: EdgeInsets.all(14),
              child: SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
              ),
            ),
          if (t != null && !_actionLoading)
            PopupMenuButton<String>(
              icon: const Icon(Icons.more_vert),
              tooltip: 'Aksi tiket',
              onSelected: (value) => _handleAction(value, t, auth),
              itemBuilder: (_) => _buildMenuItems(t, auth),
            ),
        ],
      ),
      body: Column(
        children: [
          const ConnectionBanner(),
          // Header tiket
          if (t != null) _TicketHeader(ticket: t),
          if (_actionError != null)
            Container(
              width: double.infinity,
              color: cs.errorContainer,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Text(_actionError!,
                  style: TextStyle(color: cs.onErrorContainer)),
            ),
          // Daftar pesan
          Expanded(
            child: _loadingTicket && _chatProvider.messages.isEmpty
                ? const Center(child: CircularProgressIndicator())
                : ChangeNotifierProvider.value(
                    value: _chatProvider,
                    child: Consumer<ChatProvider>(
                      builder: (ctx, chat, _) {
                        WidgetsBinding.instance
                            .addPostFrameCallback((_) => _scrollToBottom());
                        return ListView.builder(
                          controller: _scrollCtrl,
                          padding: const EdgeInsets.symmetric(
                              vertical: 8, horizontal: 4),
                          itemCount: chat.messages.length,
                          itemBuilder: (ctx, i) {
                            final msg = chat.messages[i];
                            return MessageBubble(
                              message: msg,
                              myUserId: auth.user?.id,
                              onDelete: msg.isFailed && msg.clientMessageId != null
                                  ? () => chat.deletePending(msg.clientMessageId!)
                                  : null,
                            );
                          },
                        );
                      },
                    ),
                  ),
          ),
          // Input
          _ReplyInput(
            controller: _inputCtrl,
            enabled: _canReply(t, auth),
            hintText: _replyHint(t, auth),
            onSend: () async {
              final text = _inputCtrl.text;
              _inputCtrl.clear();
              await _chatProvider.sendMessage(text);
              _scrollToBottom();
            },
          ),
        ],
      ),
    );
  }

  List<PopupMenuEntry<String>> _buildMenuItems(Ticket t, AuthProvider auth) {
    final items = <PopupMenuEntry<String>>[];
    final isAssignee = t.assignedAgent?.id == auth.user?.id;
    final isAdmin = auth.isAdmin;
    final canAct = isAssignee || isAdmin;

    if (t.status == 'OPEN' && t.assignedAgent == null) {
      items.add(const PopupMenuItem(
          value: 'claim', child: Text('Ambil Tiket')));
    }
    if (t.status == 'IN_PROGRESS' && canAct) {
      items.add(const PopupMenuItem(
          value: 'release', child: Text('Lepas Tiket')));
      items.add(const PopupMenuItem(
          value: 'resolve', child: Text('Tandai Resolved')));
    }
    if (t.status == 'RESOLVED' && canAct) {
      items.add(const PopupMenuItem(
          value: 'reopen', child: Text('Buka Kembali')));
      items.add(const PopupMenuItem(
          value: 'close', child: Text('Tutup Tiket')));
    }
    if (t.status != 'CLOSED' && canAct) {
      items.add(const PopupMenuDivider());
      items.add(const PopupMenuItem(
          value: 'priority_low',
          child: Text('Prioritas: Rendah')));
      items.add(const PopupMenuItem(
          value: 'priority_medium',
          child: Text('Prioritas: Sedang')));
      items.add(const PopupMenuItem(
          value: 'priority_high',
          child: Text('Prioritas: Tinggi')));
    }
    return items;
  }

  void _handleAction(String action, Ticket t, AuthProvider auth) {
    final repo = TicketRepository();
    switch (action) {
      case 'claim':
        _doAction(() => repo.claim(t.id));
        break;
      case 'release':
        _doAction(() => repo.release(t.id));
        break;
      case 'resolve':
        _doAction(() => repo.patch(t.id, status: 'RESOLVED'));
        break;
      case 'reopen':
        _doAction(() => repo.patch(t.id, status: 'IN_PROGRESS'));
        break;
      case 'close':
        _doAction(() => repo.patch(t.id, status: 'CLOSED'));
        break;
      case 'priority_low':
        _doAction(() => repo.patch(t.id, priority: 'LOW'));
        break;
      case 'priority_medium':
        _doAction(() => repo.patch(t.id, priority: 'MEDIUM'));
        break;
      case 'priority_high':
        _doAction(() => repo.patch(t.id, priority: 'HIGH'));
        break;
    }
  }
}

class _TicketHeader extends StatelessWidget {
  final Ticket ticket;
  const _TicketHeader({required this.ticket});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Container(
      color: cs.surfaceContainerLow,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  ticket.subject,
                  style: const TextStyle(fontWeight: FontWeight.w600),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  ticket.assignedAgent != null
                      ? 'Agen: ${ticket.assignedAgent!.name}'
                      : 'Belum ada agen',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
          ),
          PriorityBadge(ticket: ticket),
        ],
      ),
    );
  }
}

class _ReplyInput extends StatelessWidget {
  final TextEditingController controller;
  final bool enabled;
  final String hintText;
  final VoidCallback onSend;

  const _ReplyInput({
    required this.controller,
    required this.enabled,
    required this.hintText,
    required this.onSend,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        border: Border(
          top: BorderSide(
              color: Theme.of(context).colorScheme.outlineVariant),
        ),
      ),
      padding: const EdgeInsets.fromLTRB(12, 8, 8, 12),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: controller,
              enabled: enabled,
              minLines: 1,
              maxLines: 4,
              decoration: InputDecoration(
                hintText: hintText,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(24),
                ),
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              ),
              textInputAction: TextInputAction.newline,
            ),
          ),
          const SizedBox(width: 8),
          IconButton.filled(
            onPressed: enabled ? onSend : null,
            icon: const Icon(Icons.send_rounded),
          ),
        ],
      ),
    );
  }
}
