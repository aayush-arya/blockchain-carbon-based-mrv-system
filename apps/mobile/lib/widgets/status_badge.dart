import 'package:flutter/material.dart';
import '../models/mrv_record.dart';
import '../models/queued_observation.dart';

class StatusBadge extends StatelessWidget {
  final String label;
  final Color color;

  const StatusBadge({super.key, required this.label, required this.color});

  factory StatusBadge.mrvStatus(String status) {
    final label = mrvStatusLabels[status] ?? status;
    final Color color;
    switch (status) {
      case 'verified':
      case 'tokenized':
        color = const Color(0xFF15803D);
        break;
      case 'pending_validation':
      case 'submitted':
      case 'ai_analyzed':
        color = const Color(0xFFB45309);
        break;
      case 'rejected':
        color = const Color(0xFFB91C1C);
        break;
      default:
        color = const Color(0xFF57534E);
    }
    return StatusBadge(label: label, color: color);
  }

  factory StatusBadge.syncStatus(SyncStatus status) {
    switch (status) {
      case SyncStatus.pending:
        return const StatusBadge(label: 'Waiting to sync', color: Color(0xFF57534E));
      case SyncStatus.syncing:
        return const StatusBadge(label: 'Syncing…', color: Color(0xFF1D4ED8));
      case SyncStatus.synced:
        return const StatusBadge(label: 'Synced', color: Color(0xFF15803D));
      case SyncStatus.failed:
        return const StatusBadge(label: 'Failed', color: Color(0xFFB91C1C));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w600),
      ),
    );
  }
}
