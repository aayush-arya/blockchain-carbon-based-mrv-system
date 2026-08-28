import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/ecosystem.dart';
import '../models/mrv_record.dart';
import '../models/queued_observation.dart';
import '../services/mrv_service.dart';
import '../state/auth_provider.dart';
import '../state/sync_provider.dart';
import '../theme.dart';
import '../widgets/app_shell.dart';
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
            icon: const Icon(Icons.logout_outlined),
            tooltip: 'Sign out',
            onPressed: () => context.read<AuthProvider>().logout(),
          ),
          const SizedBox(width: 4),
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
        color: AppColors.brand600,
        onRefresh: () async {
          _refresh();
          await sync.syncNow();
        },
        child: AppShell(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 96),
            children: [
              _SyncBanner(sync: sync),
              if (sync.pendingCount > 0 || sync.isSyncing) const SizedBox(height: 12),
              _ProfileCard(fullName: auth.user?.fullName, role: auth.user?.role),
              const SizedBox(height: 16),
              FutureBuilder<List<MrvRecordSummary>>(
                future: _mrvFuture,
                builder: (context, snapshot) {
                  final records = snapshot.data ?? [];
                  return _StatsRow(
                    total: records.length,
                    pending: records.where((r) => r.status == 'pending_validation' || r.status == 'submitted' || r.status == 'ai_analyzed').length,
                    verified: records.where((r) => r.status == 'verified' || r.status == 'tokenized').length,
                  );
                },
              ),
              if (sync.items.isNotEmpty) ...[
                const SizedBox(height: 20),
                _SectionHeader(title: 'Pending sync', count: sync.items.length),
                const SizedBox(height: 8),
                Card(
                  child: Column(
                    children: [
                      for (var i = 0; i < sync.items.length; i++) ...[
                        if (i > 0) const Divider(),
                        _QueuedTile(item: sync.items[i]),
                      ],
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 20),
              const _SectionHeader(title: 'Submitted'),
              const SizedBox(height: 8),
              FutureBuilder<List<MrvRecordSummary>>(
                future: _mrvFuture,
                builder: (context, snapshot) {
                  if (snapshot.connectionState == ConnectionState.waiting) {
                    return const Padding(
                      padding: EdgeInsets.symmetric(vertical: 32),
                      child: Center(child: CircularProgressIndicator(color: AppColors.brand600)),
                    );
                  }
                  if (snapshot.hasError) {
                    return _EmptyCard(
                      icon: Icons.error_outline,
                      title: 'Could not load submissions',
                      message: '${snapshot.error}',
                    );
                  }
                  final records = snapshot.data ?? [];
                  if (records.isEmpty) {
                    return const _EmptyState();
                  }
                  return Card(
                    child: Column(
                      children: [
                        for (var i = 0; i < records.length; i++) ...[
                          if (i > 0) const Divider(),
                          _MrvTile(record: records[i]),
                        ],
                      ],
                    ),
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StatsRow extends StatelessWidget {
  final int total;
  final int pending;
  final int verified;
  const _StatsRow({required this.total, required this.pending, required this.verified});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(child: _StatTile(label: 'Total', value: total, icon: Icons.folder_outlined)),
        const SizedBox(width: 10),
        Expanded(
          child: _StatTile(
            label: 'In review',
            value: pending,
            icon: Icons.hourglass_top_outlined,
            accent: pending > 0 ? AppColors.statusWarning : null,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _StatTile(
            label: 'Verified',
            value: verified,
            icon: Icons.verified_outlined,
            accent: verified > 0 ? AppColors.statusSuccess : null,
          ),
        ),
      ],
    );
  }
}

class _StatTile extends StatelessWidget {
  final String label;
  final int value;
  final IconData icon;
  final Color? accent;
  const _StatTile({required this.label, required this.value, required this.icon, this.accent});

  @override
  Widget build(BuildContext context) {
    final color = accent ?? AppColors.inkMuted;
    return Card(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, size: 18, color: color),
            const SizedBox(height: 10),
            Text(
              '$value',
              style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: AppColors.ink, height: 1),
            ),
            const SizedBox(height: 2),
            Text(label, style: const TextStyle(fontSize: 11, color: AppColors.inkFaint)),
          ],
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 28, horizontal: 20),
        child: Column(
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(color: AppColors.brand50, shape: BoxShape.circle),
              child: const Icon(Icons.eco_outlined, size: 28, color: AppColors.brand600),
            ),
            const SizedBox(height: 14),
            const Text(
              'No submissions yet',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16, color: AppColors.ink),
            ),
            const SizedBox(height: 4),
            const Text(
              'Capture a photo, GPS location, and a few details - it uploads automatically, even if you\'re offline right now.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.inkFaint, fontSize: 13, height: 1.4),
            ),
            const SizedBox(height: 18),
            const Divider(),
            const SizedBox(height: 14),
            const _HowItWorksStep(number: '1', text: 'Capture a photo and GPS location in the field'),
            const SizedBox(height: 10),
            const _HowItWorksStep(number: '2', text: 'It queues on this device and uploads automatically'),
            const SizedBox(height: 10),
            const _HowItWorksStep(number: '3', text: 'A validator reviews it before it\'s tokenized on-chain'),
          ],
        ),
      ),
    );
  }
}

class _HowItWorksStep extends StatelessWidget {
  final String number;
  final String text;
  const _HowItWorksStep({required this.number, required this.text});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 22,
          height: 22,
          alignment: Alignment.center,
          decoration: const BoxDecoration(color: AppColors.brand100, shape: BoxShape.circle),
          child: Text(number, style: const TextStyle(color: AppColors.brand700, fontSize: 11, fontWeight: FontWeight.w700)),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(text, style: const TextStyle(color: AppColors.inkMuted, fontSize: 13), textAlign: TextAlign.left),
        ),
      ],
    );
  }
}

class _ProfileCard extends StatelessWidget {
  final String? fullName;
  final String? role;
  const _ProfileCard({required this.fullName, required this.role});

  @override
  Widget build(BuildContext context) {
    final initial = (fullName?.isNotEmpty ?? false) ? fullName![0].toUpperCase() : '?';
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            CircleAvatar(
              radius: 20,
              backgroundColor: AppColors.brand100,
              child: Text(initial, style: const TextStyle(color: AppColors.brand700, fontWeight: FontWeight.w700)),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(fullName ?? '', style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.ink)),
                  const SizedBox(height: 2),
                  Text(
                    (role ?? '').replaceAll('_', ' '),
                    style: const TextStyle(color: AppColors.inkFaint, fontSize: 12),
                  ),
                ],
              ),
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
      bg = AppColors.statusWarningBg;
      fg = AppColors.statusWarning;
      icon = Icons.cloud_off_outlined;
      text = sync.pendingCount > 0
          ? 'Offline - ${sync.pendingCount} observation(s) waiting to sync'
          : 'Offline';
    } else if (sync.isSyncing) {
      bg = AppColors.statusInfoBg;
      fg = AppColors.statusInfo;
      icon = Icons.sync;
      text = 'Syncing…';
    } else if (sync.pendingCount > 0) {
      bg = AppColors.statusInfoBg;
      fg = AppColors.statusInfo;
      icon = Icons.cloud_upload_outlined;
      text = '${sync.pendingCount} observation(s) waiting to sync';
    } else {
      return const SizedBox.shrink();
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(10)),
      child: Row(
        children: [
          Icon(icon, size: 18, color: fg),
          const SizedBox(width: 10),
          Expanded(child: Text(text, style: TextStyle(color: fg, fontSize: 13, fontWeight: FontWeight.w500))),
          if (sync.isOnline && !sync.isSyncing && sync.pendingCount > 0)
            TextButton(
              style: TextButton.styleFrom(foregroundColor: fg, padding: const EdgeInsets.symmetric(horizontal: 8)),
              onPressed: sync.syncNow,
              child: const Text('Sync now', style: TextStyle(fontWeight: FontWeight.w600)),
            ),
        ],
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;
  final int? count;
  const _SectionHeader({required this.title, this.count});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Text(
          title.toUpperCase(),
          style: Theme.of(context).textTheme.labelSmall,
        ),
        if (count != null) ...[
          const SizedBox(width: 6),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 1),
            decoration: BoxDecoration(color: AppColors.brand100, borderRadius: BorderRadius.circular(999)),
            child: Text(
              '$count',
              style: const TextStyle(color: AppColors.brand700, fontSize: 11, fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ],
    );
  }
}

class _EmptyCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String message;
  const _EmptyCard({required this.icon, required this.title, required this.message});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 36, horizontal: 20),
        child: Column(
          children: [
            Icon(icon, size: 32, color: AppColors.inkFaint),
            const SizedBox(height: 10),
            Text(title, style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.ink)),
            const SizedBox(height: 4),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.inkFaint, fontSize: 13),
            ),
          ],
        ),
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
        borderRadius: BorderRadius.circular(8),
        child: Image.memory(item.imageBytes, width: 44, height: 44, fit: BoxFit.cover),
      ),
      title: Text(
        item.ecosystemCode.replaceAll('_', ' '),
        style: const TextStyle(fontWeight: FontWeight.w600),
      ),
      subtitle: item.errorMessage != null
          ? Text(item.errorMessage!, style: const TextStyle(color: AppColors.statusDanger, fontSize: 12))
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
      leading: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(color: AppColors.brand50, borderRadius: BorderRadius.circular(8)),
        child: const Icon(Icons.eco_outlined, color: AppColors.brand600, size: 20),
      ),
      title: Text(record.mrvCode, style: const TextStyle(fontWeight: FontWeight.w600, fontFeatures: [FontFeature.tabularFigures()])),
      subtitle: Text(record.ecosystemCode.label, style: const TextStyle(fontSize: 12)),
      trailing: StatusBadge.mrvStatus(record.status),
    );
  }
}
