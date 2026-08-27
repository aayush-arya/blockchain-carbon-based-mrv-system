import '../models/user.dart';
import 'api_client.dart';
import 'token_storage.dart';

class AuthService {
  final ApiClient _api;
  final TokenStorage _tokens;

  AuthService(this._api, this._tokens);

  Future<User> login(String email, String password) async {
    final body = await _api.post(
      '/api/auth/login',
      body: {'email': email, 'password': password},
      skipAuth: true,
    );
    return _storeAndReturnUser(body);
  }

  Future<User> register(String email, String password, String fullName) async {
    final body = await _api.post(
      '/api/auth/register',
      body: {'email': email, 'password': password, 'fullName': fullName},
      skipAuth: true,
    );
    return _storeAndReturnUser(body);
  }

  Future<User?> currentUser() async {
    final token = await _tokens.accessToken;
    if (token == null) return null;
    try {
      final body = await _api.get('/api/auth/me');
      return User.fromJson(body['user'] as Map<String, dynamic>);
    } on ApiException {
      await _tokens.clear();
      return null;
    }
  }

  Future<void> logout() async {
    await _tokens.clear();
  }

  Future<User> _storeAndReturnUser(Map<String, dynamic> body) async {
    final tokens = body['tokens'] as Map<String, dynamic>;
    await _tokens.save(
      accessToken: tokens['accessToken'] as String,
      refreshToken: tokens['refreshToken'] as String,
    );
    return User.fromJson(body['user'] as Map<String, dynamic>);
  }
}
