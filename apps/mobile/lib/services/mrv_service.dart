import '../models/mrv_record.dart';
import 'api_client.dart';

class MrvService {
  final ApiClient _api;

  MrvService(this._api);

  Future<List<MrvRecordSummary>> listMine({int pageSize = 50}) async {
    final body = await _api.get('/api/mrv?pageSize=$pageSize');
    final rows = body['mrvRecords'] as List<dynamic>;
    return rows.map((r) => MrvRecordSummary.fromJson(r as Map<String, dynamic>)).toList();
  }
}
