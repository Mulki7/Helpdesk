/// Model Pesan.
class Message {
  final int id;
  final int ticketId;
  final String senderType; // CUSTOMER | AGENT | SYSTEM
  final String? senderName;
  final String body;
  final String? clientMessageId;
  final DateTime createdAt;
  final bool isPending; // hanya untuk pesan yang dikirim lokal
  final bool isFailed; // gagal kirim (validasi/hak akses)

  const Message({
    required this.id,
    required this.ticketId,
    required this.senderType,
    this.senderName,
    required this.body,
    this.clientMessageId,
    required this.createdAt,
    this.isPending = false,
    this.isFailed = false,
  });

  factory Message.fromJson(Map<String, dynamic> json) {
    return Message(
      id: json['id'] as int,
      ticketId: json['ticketId'] as int,
      senderType: json['senderType'] as String,
      senderName: (json['senderUser'] as Map<String, dynamic>?)?['name']
          as String?,
      body: json['body'] as String,
      clientMessageId: json['clientMessageId'] as String?,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }

  /// Buat pesan lokal pending sebelum ack server.
  factory Message.pending({
    required int ticketId,
    required String body,
    required String clientMessageId,
  }) {
    return Message(
      id: -1, // belum ada id server
      ticketId: ticketId,
      senderType: 'AGENT',
      body: body,
      clientMessageId: clientMessageId,
      createdAt: DateTime.now().toUtc(),
      isPending: true,
      isFailed: false,
    );
  }

  Message copyWith({int? id, bool? isPending, bool? isFailed}) {
    return Message(
      id: id ?? this.id,
      ticketId: ticketId,
      senderType: senderType,
      senderName: senderName,
      body: body,
      clientMessageId: clientMessageId,
      createdAt: createdAt,
      isPending: isPending ?? this.isPending,
      isFailed: isFailed ?? this.isFailed,
    );
  }
}
