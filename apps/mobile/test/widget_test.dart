import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/models/ecosystem.dart';

void main() {
  group('EcosystemCode', () {
    test('round-trips through the API string value', () {
      for (final code in EcosystemCode.values) {
        expect(EcosystemCodeX.fromApiValue(code.apiValue), code);
      }
    });

    test('uses the backend enum spelling, not the Dart identifier', () {
      // saltMarsh -> 'salt_marsh', matching apps/backend's ecosystem_code enum - a naive
      // implementation might emit the Dart-cased name instead and pass every *other* check.
      expect(EcosystemCode.saltMarsh.apiValue, 'salt_marsh');
    });

    test('rejects an unknown API value', () {
      expect(() => EcosystemCodeX.fromApiValue('kelp_forest'), throwsArgumentError);
    });
  });
}
