enum EcosystemCode { mangrove, seagrass, saltMarsh }

extension EcosystemCodeX on EcosystemCode {
  String get apiValue {
    switch (this) {
      case EcosystemCode.mangrove:
        return 'mangrove';
      case EcosystemCode.seagrass:
        return 'seagrass';
      case EcosystemCode.saltMarsh:
        return 'salt_marsh';
    }
  }

  String get label {
    switch (this) {
      case EcosystemCode.mangrove:
        return 'Mangrove';
      case EcosystemCode.seagrass:
        return 'Seagrass';
      case EcosystemCode.saltMarsh:
        return 'Salt Marsh';
    }
  }

  static EcosystemCode fromApiValue(String value) {
    switch (value) {
      case 'mangrove':
        return EcosystemCode.mangrove;
      case 'seagrass':
        return EcosystemCode.seagrass;
      case 'salt_marsh':
        return EcosystemCode.saltMarsh;
      default:
        throw ArgumentError('Unknown ecosystem code: $value');
    }
  }
}
