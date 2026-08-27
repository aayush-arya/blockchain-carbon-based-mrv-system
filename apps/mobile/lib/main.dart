import 'package:flutter/material.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:provider/provider.dart';
import 'screens/home_screen.dart';
import 'screens/login_screen.dart';
import 'services/api_client.dart';
import 'services/auth_service.dart';
import 'services/connectivity_service.dart';
import 'services/mrv_service.dart';
import 'services/sync_queue_service.dart';
import 'services/token_storage.dart';
import 'state/auth_provider.dart';
import 'state/sync_provider.dart';
import 'theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Hive.initFlutter();

  final tokenStorage = TokenStorage();
  final apiClient = ApiClient(tokenStorage);
  final syncQueue = SyncQueueService();
  await syncQueue.init();

  runApp(BlueCarbonApp(
    tokenStorage: tokenStorage,
    apiClient: apiClient,
    syncQueue: syncQueue,
  ));
}

class BlueCarbonApp extends StatelessWidget {
  final TokenStorage tokenStorage;
  final ApiClient apiClient;
  final SyncQueueService syncQueue;

  const BlueCarbonApp({
    super.key,
    required this.tokenStorage,
    required this.apiClient,
    required this.syncQueue,
  });

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        Provider.value(value: apiClient),
        Provider(create: (_) => MrvService(apiClient)),
        ChangeNotifierProvider(
          create: (_) => AuthProvider(AuthService(apiClient, tokenStorage))..bootstrap(),
        ),
        ChangeNotifierProvider(
          create: (_) => SyncProvider(syncQueue, apiClient, ConnectivityService())..init(),
        ),
      ],
      child: MaterialApp(
        title: 'Blue Carbon Registry',
        theme: appTheme,
        debugShowCheckedModeBanner: false,
        home: const _AuthGate(),
      ),
    );
  }
}

class _AuthGate extends StatelessWidget {
  const _AuthGate();

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    if (auth.isLoading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    return auth.user != null ? const HomeScreen() : const LoginScreen();
  }
}
