import 'dart:typed_data';
import 'package:hive/hive.dart';

enum SyncStatus { pending, syncing, synced, failed }

class QueuedObservation extends HiveObject {
  final String localId;
  String ecosystemCode;
  double latitude;
  double longitude;
  String capturedAt;
  double reportedAreaM2;
  String? notes;
  Uint8List imageBytes;
  String imageFilename;
  String imageMimeType;
  SyncStatus status;
  String? errorMessage;
  final String queuedAt;
  String? syncedMrvCode;

  QueuedObservation({
    required this.localId,
    required this.ecosystemCode,
    required this.latitude,
    required this.longitude,
    required this.capturedAt,
    required this.reportedAreaM2,
    this.notes,
    required this.imageBytes,
    required this.imageFilename,
    required this.imageMimeType,
    this.status = SyncStatus.pending,
    this.errorMessage,
    required this.queuedAt,
    this.syncedMrvCode,
  });
}

/// Hand-written rather than build_runner-generated - the schema is small and stable, and this
/// avoids adding a code-gen step to a project that otherwise has none.
class QueuedObservationAdapter extends TypeAdapter<QueuedObservation> {
  @override
  final int typeId = 0;

  @override
  QueuedObservation read(BinaryReader reader) {
    final numOfFields = reader.readByte();
    final fields = <int, dynamic>{
      for (int i = 0; i < numOfFields; i++) reader.readByte(): reader.read(),
    };
    return QueuedObservation(
      localId: fields[0] as String,
      ecosystemCode: fields[1] as String,
      latitude: fields[2] as double,
      longitude: fields[3] as double,
      capturedAt: fields[4] as String,
      reportedAreaM2: fields[5] as double,
      notes: fields[6] as String?,
      imageBytes: fields[7] as Uint8List,
      imageFilename: fields[8] as String,
      imageMimeType: fields[9] as String,
      status: SyncStatus.values[fields[10] as int],
      errorMessage: fields[11] as String?,
      queuedAt: fields[12] as String,
      syncedMrvCode: fields[13] as String?,
    );
  }

  @override
  void write(BinaryWriter writer, QueuedObservation obj) {
    writer
      ..writeByte(14)
      ..writeByte(0)
      ..write(obj.localId)
      ..writeByte(1)
      ..write(obj.ecosystemCode)
      ..writeByte(2)
      ..write(obj.latitude)
      ..writeByte(3)
      ..write(obj.longitude)
      ..writeByte(4)
      ..write(obj.capturedAt)
      ..writeByte(5)
      ..write(obj.reportedAreaM2)
      ..writeByte(6)
      ..write(obj.notes)
      ..writeByte(7)
      ..write(obj.imageBytes)
      ..writeByte(8)
      ..write(obj.imageFilename)
      ..writeByte(9)
      ..write(obj.imageMimeType)
      ..writeByte(10)
      ..write(obj.status.index)
      ..writeByte(11)
      ..write(obj.errorMessage)
      ..writeByte(12)
      ..write(obj.queuedAt)
      ..writeByte(13)
      ..write(obj.syncedMrvCode);
  }
}
