import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive/hive.dart';
import 'package:mobile/models/queued_observation.dart';
import 'package:mobile/services/api_client.dart';
import 'package:mobile/services/auth_service.dart';
import 'package:mobile/services/sync_queue_service.dart';
import 'package:mobile/services/token_storage.dart';

/// In-memory KeyValueStore, standing in only for flutter_secure_storage - the one dependency
/// in this chain that needs a real device/browser rather than the plain Dart VM `flutter test`
/// runs in. Everything else (HTTP, Hive) is real.
class InMemoryKeyValueStore implements KeyValueStore {
  final _data = <String, String>{};
  @override
  Future<void> write(String key, String value) async => _data[key] = value;
  @override
  Future<String?> read(String key) async => _data[key];
  @override
  Future<void> delete(String key) async => _data.remove(key);
}

// A tiny, genuinely valid, decodable JPEG (solid color is fine here - unlike the backend's own
// AI-analysis tests, this flow never calls the AI service, only create+submit).
final _jpegBytes = Uint8List.fromList(base64Decode(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a'
  'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIy'
  'MjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIA'
  'AhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEB'
  'AQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX'
  '/9k=',
));

/// This is a genuine integration test - it hits the real backend at localhost:4000 (the same
/// one apps/web talks to), not a mock. Requires the dev stack to be running.
void main() {
  const baseUrl = 'http://localhost:4000';

  setUp(() async {
    // Fail fast with a clear message rather than a confusing connection-refused deep in the
    // test body if the backend isn't up.
    try {
      final res = await HttpClient().getUrl(Uri.parse('$baseUrl/api/system/health')).then((r) => r.close());
      await res.drain();
    } catch (e) {
      fail('Backend not reachable at $baseUrl - start the dev stack before running this test ($e)');
    }
  });

  test('register -> currentUser round trip against the real backend', () async {
    final tokens = TokenStorage(InMemoryKeyValueStore());
    final api = ApiClient(tokens);
    final auth = AuthService(api, tokens);

    final email = 'mobile-test-${DateTime.now().millisecondsSinceEpoch}@example.test';
    final user = await auth.register(email, 'correct-horse-1', 'Mobile Integration Test');
    expect(user.email, email);
    expect(user.role, 'field_operator');

    final fetched = await auth.currentUser();
    expect(fetched, isNotNull);
    expect(fetched!.id, user.id);
  });

  test('queueing an observation offline and syncing produces a real MRV record', () async {
    final tokens = TokenStorage(InMemoryKeyValueStore());
    final api = ApiClient(tokens);
    final auth = AuthService(api, tokens);

    final email = 'mobile-sync-${DateTime.now().millisecondsSinceEpoch}@example.test';
    await auth.register(email, 'correct-horse-1', 'Mobile Sync Test');

    final tempDir = await Directory.systemTemp.createTemp('hive_sync_test_');
    Hive.init(tempDir.path);
    if (!Hive.isAdapterRegistered(0)) {
      Hive.registerAdapter(QueuedObservationAdapter());
    }
    final queue = SyncQueueService();
    await queue.init();
    addTearDown(() async {
      await Hive.close();
      await tempDir.delete(recursive: true);
    });

    final observation = QueuedObservation(
      localId: 'integration-test-1',
      ecosystemCode: 'mangrove',
      latitude: 21.6417,
      longitude: 87.9959,
      capturedAt: DateTime.now().toUtc().toIso8601String(),
      reportedAreaM2: 1200,
      notes: 'Mobile integration test observation',
      imageBytes: _jpegBytes,
      imageFilename: 'test-evidence.jpg',
      imageMimeType: 'image/jpeg',
      queuedAt: DateTime.now().toUtc().toIso8601String(),
    );

    await queue.enqueue(observation);
    expect(queue.pendingCount, 1);

    await queue.syncAll(api);

    final synced = queue.listAll().first;
    expect(
      synced.status,
      SyncStatus.synced,
      reason: 'sync failed: ${synced.errorMessage}',
    );
    expect(synced.syncedMrvCode, matches(RegExp(r'^MRV-\d{6}$')));
    expect(queue.pendingCount, 0);

    // Confirm it's genuinely on the server, not just marked synced locally.
    final list = await api.get('/api/mrv?pageSize=50');
    final codes = (list['mrvRecords'] as List).map((r) => r['mrv_code']);
    expect(codes, contains(synced.syncedMrvCode));
  });

  test('a failed sync (bad data) is marked failed with a real server error, not silently dropped', () async {
    final tokens = TokenStorage(InMemoryKeyValueStore());
    final api = ApiClient(tokens);
    final auth = AuthService(api, tokens);
    final email = 'mobile-syncfail-${DateTime.now().millisecondsSinceEpoch}@example.test';
    await auth.register(email, 'correct-horse-1', 'Mobile Sync Fail Test');

    final tempDir = await Directory.systemTemp.createTemp('hive_sync_fail_test_');
    Hive.init(tempDir.path);
    if (!Hive.isAdapterRegistered(0)) {
      Hive.registerAdapter(QueuedObservationAdapter());
    }
    final queue = SyncQueueService();
    await queue.init();
    addTearDown(() async {
      await Hive.close();
      await tempDir.delete(recursive: true);
    });

    // reportedAreaM2 of 0 fails the backend's validator (must be > 0).
    final observation = QueuedObservation(
      localId: 'integration-test-2',
      ecosystemCode: 'mangrove',
      latitude: 21.6417,
      longitude: 87.9959,
      capturedAt: DateTime.now().toUtc().toIso8601String(),
      reportedAreaM2: 0,
      imageBytes: _jpegBytes,
      imageFilename: 'test-evidence.jpg',
      imageMimeType: 'image/jpeg',
      queuedAt: DateTime.now().toUtc().toIso8601String(),
    );

    await queue.enqueue(observation);
    await queue.syncAll(api);

    final result = queue.listAll().first;
    expect(result.status, SyncStatus.failed);
    expect(result.errorMessage, isNotNull);
    expect(queue.pendingCount, 1, reason: 'a failed item should stay in the queue for retry');
  });
}
