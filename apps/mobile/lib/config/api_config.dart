/// The dev backend accepts any localhost origin regardless of port (see
/// apps/backend/src/app.ts), so this works unchanged for the Windows desktop and Chrome run
/// targets used to verify this app. A real device build would need this pointed at a reachable
/// host instead.
const String apiBaseUrl = 'http://localhost:4000';
