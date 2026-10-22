/// Model Tiket.
class Ticket {
  final int id;
  final String number; // HD-0001
  final String subject;
  final String status; // OPEN | IN_PROGRESS | RESOLVED | CLOSED
  final String priority; // LOW | MEDIUM | HIGH
  final TicketCustomer customer;
  final TicketAgent? assignedAgent;
  final TicketLastMessage? lastMessage;
  final DateTime createdAt;
  final DateTime updatedAt;

  const Ticket({
    required this.id,
    required this.number,
    required this.subject,
    required this.status,
    required this.priority,
    required this.customer,
    this.assignedAgent,
    this.lastMessage,
    required this.createdAt,
    required this.updatedAt,
  });

  factory Ticket.fromJson(Map<String, dynamic> json) {
    return Ticket(
      id: json['id'] as int,
      number: json['number'] as String,
      subject: json['subject'] as String,
      status: json['status'] as String,
      priority: json['priority'] as String,
      customer: TicketCustomer.fromJson(
          json['customer'] as Map<String, dynamic>),
      assignedAgent: json['assignedAgent'] != null
          ? TicketAgent.fromJson(
              json['assignedAgent'] as Map<String, dynamic>)
          : null,
      lastMessage: json['lastMessage'] != null
          ? TicketLastMessage.fromJson(
              json['lastMessage'] as Map<String, dynamic>)
          : null,
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
    );
  }

  Ticket copyWith({
    String? status,
    String? priority,
    TicketAgent? assignedAgent,
    bool clearAgent = false,
    TicketLastMessage? lastMessage,
    DateTime? updatedAt,
  }) {
    return Ticket(
      id: id,
      number: number,
      subject: subject,
      status: status ?? this.status,
      priority: priority ?? this.priority,
      customer: customer,
      assignedAgent: clearAgent ? null : (assignedAgent ?? this.assignedAgent),
      lastMessage: lastMessage ?? this.lastMessage,
      createdAt: createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}

class TicketCustomer {
  final int id;
  final String name;
  final String? email;

  const TicketCustomer({required this.id, required this.name, this.email});

  factory TicketCustomer.fromJson(Map<String, dynamic> json) {
    return TicketCustomer(
      id: json['id'] as int,
      name: json['name'] as String,
      email: json['email'] as String?,
    );
  }
}

class TicketAgent {
  final int id;
  final String name;

  const TicketAgent({required this.id, required this.name});

  factory TicketAgent.fromJson(Map<String, dynamic> json) {
    return TicketAgent(
      id: json['id'] as int,
      name: json['name'] as String,
    );
  }
}

class TicketLastMessage {
  final String body;
  final String senderType;
  final DateTime createdAt;

  const TicketLastMessage({
    required this.body,
    required this.senderType,
    required this.createdAt,
  });

  factory TicketLastMessage.fromJson(Map<String, dynamic> json) {
    return TicketLastMessage(
      body: json['body'] as String,
      senderType: json['senderType'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }
}
