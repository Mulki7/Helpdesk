/// Model User (agent/admin).
class User {
  final int id;
  final String name;
  final String email;
  final String role; // 'AGENT' | 'ADMIN'
  final bool isActive;

  const User({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
    required this.isActive,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] as int,
      name: json['name'] as String,
      email: json['email'] as String,
      role: json['role'] as String,
      isActive: (json['isActive'] ?? true) as bool,
    );
  }

  bool get isAdmin => role == 'ADMIN';
}
