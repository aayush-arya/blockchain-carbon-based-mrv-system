import 'package:flutter/material.dart';
import '../models/mrv_record.dart';
import '../models/queued_observation.dart';
import '../theme.dart';

class StatusBadge extends StatelessWidget {
  final String label;
  final Color color;
  final Color background;

  const StatusBadge({super.key, required this.label, required this.color, required this.background});

  factory StatusBadge.mrvStatus(String status) {
    final label = mrvStatusLabels[status] ?? status;
    switch (status) {
      case 'verified':
      case 'tokenized':
        return StatusBadge(label: label, color: AppColors.statusSuccess, background: AppColors.statusSuccessBg);
      case 'pending_validation':
      case 'submitted':
      case 'ai_analyzed':
        return StatusBadge(label: label, color: AppColors.statusWarning, background: AppColors.statusWarningBg);
      case 'rejected':
        return StatusBadge(label: label, color: AppColors.statusDanger, background: AppColors.statusDangerBg);
      default:
        return StatusBadge(label: label, color: AppColors.inkMuted, background: AppColors.surfaceSunken);
    }
  }

  factory StatusBadge.syncStatus(SyncStatus status) {
    switch (status) {
      case SyncStatus.pending:
        return const StatusBadge(label: 'Waiting to sync', color: AppColors.inkMuted, background: AppColors.surfaceSunken);
      case SyncStatus.syncing:
        return const StatusBadge(label: 'Syncing…', color: AppColors.statusInfo, background: AppColors.statusInfoBg);
      case SyncStatus.synced:
        return const StatusBadge(label: 'Synced', color: AppColors.statusSuccess, background: AppColors.statusSuccessBg);
      case SyncStatus.failed:
        return const StatusBadge(label: 'Failed', color: AppColors.statusDanger, background: AppColors.statusDangerBg);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w600),
      ),
    );
  }
}
