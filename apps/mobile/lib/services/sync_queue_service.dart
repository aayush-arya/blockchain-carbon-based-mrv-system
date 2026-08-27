import 'package:hive_flutter/hive_flutter.dart';
import '../models/queued_observation.dart';
import 'api_client.dart';

/// The offline queue: every observation capture is written here first, then synced to the
/// backend when connectivity allows (see ConnectivityService + SyncProvider). This means the
/// capture flow never blocks on network, online or offline.
class SyncQueueService {
  static const _boxName = 'queued_observations';
  late Box<QueuedObservation> _box;

  Future<void> init() async {
    if (!Hive.isAdapterRegistered(0)) {
      Hive.registerAdapter(QueuedObservationAdapter());
    }
    _box = await Hive.openBox<QueuedObservation>(_boxName);
  }

  List<QueuedObservation> listAll() {
    final items = _box.values.toList();
    items.sort((a, b) => b.queuedAt.compareTo(a.queuedAt));
    return items;
  }

  int get pendingCount =>
      _box.values.where((o) => o.status == SyncStatus.pending || o.status == SyncStatus.failed).length;

  Future<void> enqueue(QueuedObservation observation) async {
    await _box.put(observation.localId, observation);
  }

  /// Attempts to sync every pending/failed item, oldest first. Each item's own failure doesn't
  /// stop the rest - a duplicate or malformed one item shouldn't block a whole batch.
  Future<void> syncAll(ApiClient api) async {
    final items = _box.values
        .where((o) => o.status == SyncStatus.pending || o.status == SyncStatus.failed)
        .toList()
      ..sort((a, b) => a.queuedAt.compareTo(b.queuedAt));

    for (final item in items) {
      await _syncOne(api, item);
    }
  }

  Future<void> _syncOne(ApiClient api, QueuedObservation item) async {
    item.status = SyncStatus.syncing;
    item.errorMessage = null;
    await item.save();

    try {
      final created = await api.postMultipart(
        '/api/observations',
        fields: {
          'ecosystemCode': item.ecosystemCode,
          'latitude': item.latitude.toString(),
          'longitude': item.longitude.toString(),
          'capturedAt': item.capturedAt,
          'reportedAreaM2': item.reportedAreaM2.toString(),
          if (item.notes != null && item.notes!.isNotEmpty) 'notes': item.notes!,
        },
        fileBytes: item.imageBytes,
        fileFieldName: 'image',
        filename: item.imageFilename,
        contentType: item.imageMimeType,
      );
      final observationId = created['observationId'] as String;

      final mrv = await api.post('/api/mrv', body: {'observationId': observationId});
      final mrvRecord = mrv['mrvRecord'] as Map<String, dynamic>;
      final mrvId = mrvRecord['id'] as String;

      await api.post('/api/mrv/$mrvId/submit');

      item.status = SyncStatus.synced;
      item.syncedMrvCode = mrvRecord['mrv_code'] as String;
      item.errorMessage = null;
    } on ApiException catch (e) {
      item.status = SyncStatus.failed;
      item.errorMessage = e.message;
    } catch (e) {
      item.status = SyncStatus.failed;
      item.errorMessage = 'Unexpected error: $e';
    }
    await item.save();
  }

  Future<void> retry(ApiClient api, String localId) async {
    final item = _box.get(localId);
    if (item == null) return;
    await _syncOne(api, item);
  }

  Future<void> remove(String localId) async {
    await _box.delete(localId);
  }
}
