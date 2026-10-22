/// Model untuk antrean pesan pending (SQLite).
class PendingMessage {
  final String clientMessageId;
  final int ticketId;
  final String body;
  final DateTime createdAt;
  final int retryCount;

  const PendingMessage({
    required this.clientMessageId,
    required this.ticketId,
    required this.body,
    required this.createdAt,
    this.retryCount = 0,
  });

  Map<String, dynamic> toMap() {
    return {
      'client_message_id': clientMessageId,
      'ticket_id': ticketId,
      'body': body,
      'created_at': createdAt.toIso8601String(),
      'retry_count': retryCount,
    };
  }

  factory PendingMessage.fromMap(Map<String, dynamic> map) {
    return PendingMessage(
      clientMessageId: map['client_message_id'] as String,
      ticketId: map['ticket_id'] as int,
      body: map['body'] as String,
      createdAt: DateTime.parse(map['created_at'] as String),
      retryCount: (map['retry_count'] as int?) ?? 0,
    );
  }

  PendingMessage copyWith({int? retryCount}) {
    return PendingMessage(
      clientMessageId: clientMessageId,
      ticketId: ticketId,
      body: body,
      createdAt: createdAt,
      retryCount: retryCount ?? this.retryCount,
    );
  }
}
