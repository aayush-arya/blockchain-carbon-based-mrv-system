import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/ecosystem.dart';
import '../models/mrv_record.dart';
import '../models/queued_observation.dart';
import '../services/mrv_service.dart';
import '../state/auth_provider.dart';
import '../state/sync_provider.dart';
import '../widgets/status_badge.dart';
import 'new_observation_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  late Future<List<MrvRecordSummary>> _mrvFuture;

  @override
  void initState() {
    super.initState();
    _mrvFuture = context.read<MrvService>().listMine();
  }

  void _refresh() {
    setState(() {
      _mrvFuture = context.read<MrvService>().listMine();
    });
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final sync = context.watch<SyncProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Observations'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'Sign out',
            onPressed: () => context.read<AuthProvider>().logout(),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          final queued = await Navigator.of(context).push<bool>(
            MaterialPageRoute(builder: (_) => const NewObservationScreen()),
          );
          if (queued == true) _refresh();
        },
        icon: const Icon(Icons.add_a_photo_outlined),
        label: const Text('New Observation'),
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          _refresh();
          await sync.syncNow();
        },
        child: ListView(
          padding: const EdgeInsets.only(bottom: 96),
          children: [
            _SyncBanner(sync: sync),
            if (auth.user != null)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                child: Text('Signed in as ${auth.user!.fullName}', style: Theme.of(context).textTheme.bodySmall),
              ),
            if (sync.items.isNotEmpty) ...[
              _SectionHeader(title: 'Pending sync (${sync.items.length})'),
              ...sync.items.map((q) => _QueuedTile(item: q)),
            ],
            _SectionHeader(title: 'Submitted'),
            FutureBuilder<List<MrvRecordSummary>>(
              future: _mrvFuture,
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Padding(
                    padding: EdgeInsets.all(24),
                    child: Center(child: CircularProgressIndicator()),
                  );
                }
                if (snapshot.hasError) {
                  return Padding(
                    padding: const EdgeInsets.all(24),
                    child: Text('Could not load submissions: ${snapshot.error}'),
                  );
                }
                final records = snapshot.data ?? [];
                if (records.isEmpty) {
                  return const Padding(
                    padding: EdgeInsets.all(24),
                    child: Text('No submissions yet.'),
                  );
                }
                return Column(children: records.map((r) => _MrvTile(record: r)).toList());
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _SyncBanner extends StatelessWidget {
  final SyncProvider sync;
  const _SyncBanner({required this.sync});

  @override
  Widget build(BuildContext context) {
    final Color bg;
    final Color fg;
    final String text;
    final IconData icon;

    if (!sync.isOnline) {
      bg = const Color(0xFFFEF3C7);
      fg = const Color(0xFF92400E);
      icon = Icons.cloud_off_outlined;
      text = sync.pendingCount > 0
          ? 'Offline - ${sync.pendingCount} observation(s) waiting to sync'
          : 'Offline';
    } else if (sync.isSyncing) {
      bg = const Color(0xFFDBEAFE);
      fg = const Color(0xFF1D4ED8);
      icon = Icons.sync;
      text = 'Syncing…';
    } else if (sync.pendingCount > 0) {
      bg = const Color(0xFFDBEAFE);
      fg = const Color(0xFF1D4ED8);
      icon = Icons.cloud_upload_outlined;
      text = '${sync.pendingCount} observation(s) waiting to sync';
    } else {
      return const SizedBox.shrink();
    }

    return Container(
      width: double.infinity,
      color: bg,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Row(
        children: [
          Icon(icon, size: 18, color: fg),
          const SizedBox(width: 8),
          Expanded(child: Text(text, style: TextStyle(color: fg, fontSize: 13))),
          if (sync.isOnline && !sync.isSyncing && sync.pendingCount > 0)
            TextButton(
              onPressed: sync.syncNow,
              child: Text('Sync now', style: TextStyle(color: fg)),
            ),
        ],
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;
  const _SectionHeader({required this.title});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      child: Text(
        title.toUpperCase(),
        style: Theme.of(context)
            .textTheme
            .labelSmall
            ?.copyWith(color: Colors.grey[600], letterSpacing: 0.5),
      ),
    );
  }
}

class _QueuedTile extends StatelessWidget {
  final QueuedObservation item;
  const _QueuedTile({required this.item});

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: ClipRRect(
        borderRadius: BorderRadius.circular(6),
        child: Image.memory(item.imageBytes, width: 44, height: 44, fit: BoxFit.cover),
      ),
      title: Text(item.ecosystemCode.replaceAll('_', ' ')),
      subtitle: item.errorMessage != null
          ? Text(item.errorMessage!, style: const TextStyle(color: Color(0xFFB91C1C), fontSize: 12))
          : null,
      trailing: item.status == SyncStatus.failed
          ? TextButton(
              onPressed: () => context.read<SyncProvider>().retry(item.localId),
              child: const Text('Retry'),
            )
          : StatusBadge.syncStatus(item.status),
    );
  }
}

class _MrvTile extends StatelessWidget {
  final MrvRecordSummary record;
  const _MrvTile({required this.record});

  @override
  Widget build(BuildContext context) {
    return ListTile(
      title: Text(record.mrvCode),
      subtitle: Text(record.ecosystemCode.label),
      trailing: StatusBadge.mrvStatus(record.status),
    );
  }
}
