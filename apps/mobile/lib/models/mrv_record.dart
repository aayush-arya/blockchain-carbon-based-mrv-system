import 'ecosystem.dart';

class MrvRecordSummary {
  final String id;
  final String mrvCode;
  final String status;
  final String? estimatedCarbonTco2e;
  final DateTime createdAt;
  final EcosystemCode ecosystemCode;

  MrvRecordSummary({
    required this.id,
    required this.mrvCode,
    required this.status,
    required this.estimatedCarbonTco2e,
    required this.createdAt,
    required this.ecosystemCode,
  });

  factory MrvRecordSummary.fromJson(Map<String, dynamic> json) {
    return MrvRecordSummary(
      id: json['id'] as String,
      mrvCode: json['mrv_code'] as String,
      status: json['status'] as String,
      estimatedCarbonTco2e: json['estimated_carbon_tco2e'] as String?,
      createdAt: DateTime.parse(json['created_at'] as String),
      ecosystemCode: EcosystemCodeX.fromApiValue(json['ecosystem_code'] as String),
    );
  }
}

const Map<String, String> mrvStatusLabels = {
  'draft': 'Draft',
  'submitted': 'Submitted',
  'ai_analyzed': 'AI Analyzed',
  'pending_validation': 'Pending Validation',
  'verified': 'Verified',
  'tokenized': 'Tokenized',
  'rejected': 'Rejected',
};
