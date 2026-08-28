import 'package:flutter/material.dart';
import '../theme.dart';

/// Small brand mark for auth screens - same idea as the web dashboard's LogoMark
/// (apps/web/components/Logo.tsx), reduced to something quick to draw in Flutter.
class BrandMark extends StatelessWidget {
  final double size;
  const BrandMark({super.key, this.size = 44});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: AppColors.brand600,
        borderRadius: BorderRadius.circular(size * 0.28),
      ),
      child: Icon(Icons.eco_outlined, color: Colors.white, size: size * 0.55),
    );
  }
}
