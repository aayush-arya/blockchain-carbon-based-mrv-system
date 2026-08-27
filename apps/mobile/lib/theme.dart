import 'package:flutter/material.dart';

/// Same restrained-teal "climate intelligence" brand as the web dashboard
/// (see apps/web/app/globals.css) rather than a default Material palette.
const _brand = Color(0xFF0F766E);

final ThemeData appTheme = ThemeData(
  useMaterial3: true,
  colorScheme: ColorScheme.fromSeed(seedColor: _brand, primary: _brand),
  scaffoldBackgroundColor: const Color(0xFFFAFAF9),
  appBarTheme: const AppBarTheme(
    backgroundColor: Color(0xFFFAFAF9),
    foregroundColor: Color(0xFF1C1917),
    elevation: 0,
  ),
  inputDecorationTheme: const InputDecorationTheme(
    border: OutlineInputBorder(borderRadius: BorderRadius.all(Radius.circular(8))),
  ),
);
