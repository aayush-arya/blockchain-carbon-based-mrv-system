import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import '../config/api_config.dart';
import 'token_storage.dart';

class ApiException implements Exception {
  final int status;
  final String code;
  final String message;

  ApiException(this.status, this.code, this.message);

  @override
  String toString() => message;
}

/// Thin REST wrapper: attaches the bearer token, retries once through a token refresh on 401
/// (deduping concurrent refreshes behind a single in-flight Future, same reasoning as the web
/// client's refreshPromise), and turns the backend's {error:{code,message}} shape into
/// ApiException.
class ApiClient {
  final TokenStorage _tokens;
  Future<bool>? _refreshInFlight;

  ApiClient(this._tokens);

  Future<Map<String, dynamic>> get(String path, {bool skipAuth = false}) =>
      _send('GET', path, skipAuth: skipAuth);

  Future<Map<String, dynamic>> post(String path, {Object? body, bool skipAuth = false}) =>
      _send('POST', path, jsonBody: body, skipAuth: skipAuth);

  Future<Map<String, dynamic>> postMultipart(
    String path, {
    required Map<String, String> fields,
    required List<int> fileBytes,
    required String fileFieldName,
    required String filename,
    required String contentType,
  }) async {
    final uri = Uri.parse('$apiBaseUrl$path');
    final request = http.MultipartRequest('POST', uri);
    request.fields.addAll(fields);
    request.files.add(
      http.MultipartFile.fromBytes(
        fileFieldName,
        fileBytes,
        filename: filename,
        contentType: MediaType.parse(contentType),
      ),
    );

    final token = await _tokens.accessToken;
    if (token != null) request.headers['Authorization'] = 'Bearer $token';

    final streamed = await request.send();
    final response = await http.Response.fromStream(streamed);

    if (response.statusCode == 401) {
      final refreshed = await _refresh();
      if (refreshed) {
        return postMultipart(
          path,
          fields: fields,
          fileBytes: fileBytes,
          fileFieldName: fileFieldName,
          filename: filename,
          contentType: contentType,
        );
      }
    }

    return _decode(response);
  }

  Future<Map<String, dynamic>> _send(
    String method,
    String path, {
    Object? jsonBody,
    bool skipAuth = false,
    bool isRetry = false,
  }) async {
    final uri = Uri.parse('$apiBaseUrl$path');
    final headers = <String, String>{'Content-Type': 'application/json'};

    if (!skipAuth) {
      final token = await _tokens.accessToken;
      if (token != null) headers['Authorization'] = 'Bearer $token';
    }

    final body = jsonBody != null ? jsonEncode(jsonBody) : null;
    late http.Response response;
    switch (method) {
      case 'GET':
        response = await http.get(uri, headers: headers);
        break;
      case 'POST':
        response = await http.post(uri, headers: headers, body: body);
        break;
      default:
        throw UnsupportedError('Unsupported method: $method');
    }

    if (response.statusCode == 401 && !skipAuth && !isRetry) {
      final refreshed = await _refresh();
      if (refreshed) {
        return _send(method, path, jsonBody: jsonBody, skipAuth: skipAuth, isRetry: true);
      }
    }

    return _decode(response);
  }

  Future<bool> _refresh() {
    return _refreshInFlight ??= _doRefresh().whenComplete(() {
      _refreshInFlight = null;
    });
  }

  Future<bool> _doRefresh() async {
    final refreshToken = await _tokens.refreshToken;
    if (refreshToken == null) return false;

    final response = await http.post(
      Uri.parse('$apiBaseUrl/api/auth/refresh'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'refreshToken': refreshToken}),
    );
    if (response.statusCode != 200) {
      await _tokens.clear();
      return false;
    }
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    final newTokens = body['tokens'] as Map<String, dynamic>;
    await _tokens.save(
      accessToken: newTokens['accessToken'] as String,
      refreshToken: newTokens['refreshToken'] as String,
    );
    return true;
  }

  Map<String, dynamic> _decode(http.Response response) {
    if (response.statusCode == 204 || response.body.isEmpty) {
      return {};
    }
    final decoded = jsonDecode(response.body);
    if (response.statusCode >= 400) {
      final error = (decoded as Map<String, dynamic>)['error'] as Map<String, dynamic>?;
      throw ApiException(
        response.statusCode,
        error?['code'] as String? ?? 'UNKNOWN',
        error?['message'] as String? ?? 'Request failed',
      );
    }
    return decoded as Map<String, dynamic>;
  }
}
