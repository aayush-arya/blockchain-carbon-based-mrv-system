import 'dart:io';
import 'dart:typed_data';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive/hive.dart';
import 'package:mobile/models/queued_observation.dart';

// Exercises the hand-written QueuedObservationAdapter through a real Hive box (not just calling
// read()/write() directly), since a field-order slip between the two methods is exactly the kind
// of bug that only shows up on an actual round trip and would otherwise silently corrupt queued
// field data.
void main() {
  late Directory tempDir;

  setUp(() async {
    tempDir = await Directory.systemTemp.createTemp('hive_test_');
    Hive.init(tempDir.path);
    if (!Hive.isAdapterRegistered(0)) {
      Hive.registerAdapter(QueuedObservationAdapter());
    }
  });

  tearDown(() async {
    await Hive.close();
    await tempDir.delete(recursive: true);
  });

  test('round-trips every field through the box, including nullable ones', () async {
    final box = await Hive.openBox<QueuedObservation>('test_box');

    final original = QueuedObservation(
      localId: 'local-1',
      ecosystemCode: 'mangrove',
      latitude: 21.6417,
      longitude: 87.9959,
      capturedAt: '2026-08-27T10:00:00.000Z',
      reportedAreaM2: 3200.5,
      notes: 'Dense canopy near the tidal creek',
      imageBytes: Uint8List.fromList([1, 2, 3, 4, 5]),
      imageFilename: 'evidence.jpg',
      imageMimeType: 'image/jpeg',
      status: SyncStatus.failed,
      errorMessage: 'Network unreachable',
      queuedAt: '2026-08-27T09:55:00.000Z',
      syncedMrvCode: null,
    );

    await box.put(original.localId, original);
    await box.close();

    final reopened = await Hive.openBox<QueuedObservation>('test_box');
    final loaded = reopened.get('local-1')!;

    expect(loaded.localId, original.localId);
    expect(loaded.ecosystemCode, original.ecosystemCode);
    expect(loaded.latitude, original.latitude);
    expect(loaded.longitude, original.longitude);
    expect(loaded.capturedAt, original.capturedAt);
    expect(loaded.reportedAreaM2, original.reportedAreaM2);
    expect(loaded.notes, original.notes);
    expect(loaded.imageBytes, original.imageBytes);
    expect(loaded.imageFilename, original.imageFilename);
    expect(loaded.imageMimeType, original.imageMimeType);
    expect(loaded.status, original.status);
    expect(loaded.errorMessage, original.errorMessage);
    expect(loaded.queuedAt, original.queuedAt);
    expect(loaded.syncedMrvCode, isNull);
  });

  test('round-trips a synced item with syncedMrvCode set and no error', () async {
    final box = await Hive.openBox<QueuedObservation>('test_box_2');
    final original = QueuedObservation(
      localId: 'local-2',
      ecosystemCode: 'seagrass',
      latitude: 10.0,
      longitude: 80.0,
      capturedAt: '2026-08-27T10:00:00.000Z',
      reportedAreaM2: 500,
      imageBytes: Uint8List.fromList([9, 9, 9]),
      imageFilename: 'a.jpg',
      imageMimeType: 'image/jpeg',
      status: SyncStatus.synced,
      queuedAt: '2026-08-27T09:00:00.000Z',
      syncedMrvCode: 'MRV-000042',
    );

    await box.put(original.localId, original);
    final loaded = box.get('local-2')!;

    expect(loaded.status, SyncStatus.synced);
    expect(loaded.syncedMrvCode, 'MRV-000042');
    expect(loaded.errorMessage, isNull);
  });
}
