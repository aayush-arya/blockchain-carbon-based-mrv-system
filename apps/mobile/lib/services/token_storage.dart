import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// The one genuinely platform-coupled dependency in TokenStorage - narrow enough to fake in
/// tests without needing platform channel bindings (flutter_secure_storage needs a real device
/// or browser to back it, which plain `flutter test` doesn't provide).
abstract class KeyValueStore {
  Future<void> write(String key, String value);
  Future<String?> read(String key);
  Future<void> delete(String key);
}

class SecureKeyValueStore implements KeyValueStore {
  final _storage = const FlutterSecureStorage();

  @override
  Future<void> write(String key, String value) => _storage.write(key: key, value: value);
  @override
  Future<String?> read(String key) => _storage.read(key: key);
  @override
  Future<void> delete(String key) => _storage.delete(key: key);
}

/// Wraps a KeyValueStore with the two fixed keys this app needs - a thin enough surface that a
/// full model class would just be indirection.
class TokenStorage {
  static const _accessKey = 'bcm.accessToken';
  static const _refreshKey = 'bcm.refreshToken';
  final KeyValueStore _store;

  TokenStorage([KeyValueStore? store]) : _store = store ?? SecureKeyValueStore();

  Future<void> save({required String accessToken, required String refreshToken}) async {
    await _store.write(_accessKey, accessToken);
    await _store.write(_refreshKey, refreshToken);
  }

  Future<String?> get accessToken => _store.read(_accessKey);
  Future<String?> get refreshToken => _store.read(_refreshKey);

  Future<void> clear() async {
    await _store.delete(_accessKey);
    await _store.delete(_refreshKey);
  }
}
