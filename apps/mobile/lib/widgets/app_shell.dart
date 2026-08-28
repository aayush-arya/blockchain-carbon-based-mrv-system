import 'package:flutter/material.dart';

/// This is a phone-shaped app - on a wide desktop browser window (the Chrome run target used
/// to verify it, see README) an unconstrained layout stretches oversized (a 4:3 photo picker
/// at 1800px wide is ~1350px tall) and pushes content below the fold. Capping content width
/// keeps every screen looking like the phone app it actually is, regardless of window width.
class AppShell extends StatelessWidget {
  final Widget child;
  final double maxWidth;

  const AppShell({super.key, required this.child, this.maxWidth = 480});

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.topCenter,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: maxWidth),
        child: child,
      ),
    );
  }
}
