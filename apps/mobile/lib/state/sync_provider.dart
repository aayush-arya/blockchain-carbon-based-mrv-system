import 'dart:async';
import 'package:flutter/foundation.dart';
import '../models/queued_observation.dart';
import '../services/api_client.dart';
import '../services/connectivity_service.dart';
import '../services/sync_queue_service.dart';

class SyncProvider extends ChangeNotifier {
  final SyncQueueService _queue;
  final ApiClient _api;
  final ConnectivityService _connectivity;
  StreamSubscription<bool>? _connectivitySub;

  SyncProvider(this._queue, this._api, this._connectivity);

  List<QueuedObservation> _items = [];
  bool _isSyncing = false;
  bool _isOnline = true;

  List<QueuedObservation> get items => _items;
  bool get isSyncing => _isSyncing;
  bool get isOnline => _isOnline;
  int get pendingCount => _queue.pendingCount;

  Future<void> init() async {
    _refresh();
    _isOnline = await _connectivity.isOnline();
    notifyListeners();
    if (_isOnline) await syncNow();

    // Auto-sync the moment connectivity comes back, so a field worker doesn't have to
    // remember to open the app again once they're back in range.
    _connectivitySub = _connectivity.onStatusChange.listen((online) async {
      final wasOffline = !_isOnline;
      _isOnline = online;
      notifyListeners();
      if (online && wasOffline) {
        await syncNow();
      }
    });
  }

  Future<void> enqueue(QueuedObservation observation) async {
    await _queue.enqueue(observation);
    _refresh();
    if (_isOnline) await syncNow();
  }

  Future<void> syncNow() async {
    if (_isSyncing) return;
    _isSyncing = true;
    notifyListeners();
    await _queue.syncAll(_api);
    _refresh();
    _isSyncing = false;
    notifyListeners();
  }

  Future<void> retry(String localId) async {
    await _queue.retry(_api, localId);
    _refresh();
    notifyListeners();
  }

  void _refresh() {
    _items = _queue.listAll();
    notifyListeners();
  }

  @override
  void dispose() {
    _connectivitySub?.cancel();
    super.dispose();
  }
}
