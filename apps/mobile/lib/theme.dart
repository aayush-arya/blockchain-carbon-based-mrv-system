import 'package:flutter/material.dart';

/// Same restrained-teal "climate intelligence" brand as the web dashboard
/// (see apps/web/app/globals.css --brand-* tokens) rather than a default Material palette.
class AppColors {
  static const brand50 = Color(0xFFEFFBF9);
  static const brand100 = Color(0xFFD7F1EC);
  static const brand400 = Color(0xFF3AA99E);
  static const brand600 = Color(0xFF11685F);
  static const brand700 = Color(0xFF0D5049);

  static const surface = Color(0xFFFAFAF9);
  static const surfaceRaised = Color(0xFFFFFFFF);
  static const surfaceSunken = Color(0xFFF1F1EF);
  static const border = Color(0xFFE7E5E4);
  static const borderSubtle = Color(0xFFEFEEEC);

  static const ink = Color(0xFF1C1917);
  static const inkMuted = Color(0xFF57534E);
  static const inkFaint = Color(0xFF8B8681);

  static const statusSuccess = Color(0xFF15803D);
  static const statusSuccessBg = Color(0xFFE9F7EE);
  static const statusWarning = Color(0xFFB45309);
  static const statusWarningBg = Color(0xFFFCF1DE);
  static const statusDanger = Color(0xFFB91C1C);
  static const statusDangerBg = Color(0xFFFBEAEA);
  static const statusInfo = Color(0xFF1D4ED8);
  static const statusInfoBg = Color(0xFFE9EFFC);
}

final ThemeData appTheme = ThemeData(
  useMaterial3: true,
  colorScheme: ColorScheme.fromSeed(
    seedColor: AppColors.brand600,
    primary: AppColors.brand600,
    surface: AppColors.surface,
  ),
  scaffoldBackgroundColor: AppColors.surface,
  fontFamily: 'Roboto',
  appBarTheme: const AppBarTheme(
    backgroundColor: AppColors.surfaceRaised,
    foregroundColor: AppColors.ink,
    surfaceTintColor: Colors.transparent,
    elevation: 0,
    scrolledUnderElevation: 0,
    shape: Border(bottom: BorderSide(color: AppColors.borderSubtle)),
    titleTextStyle: TextStyle(color: AppColors.ink, fontSize: 18, fontWeight: FontWeight.w600),
  ),
  cardTheme: CardThemeData(
    color: AppColors.surfaceRaised,
    elevation: 0,
    margin: EdgeInsets.zero,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(12),
      side: const BorderSide(color: AppColors.border),
    ),
  ),
  listTileTheme: const ListTileThemeData(
    iconColor: AppColors.inkMuted,
    textColor: AppColors.ink,
  ),
  dividerTheme: const DividerThemeData(color: AppColors.borderSubtle, space: 1),
  inputDecorationTheme: InputDecorationTheme(
    filled: true,
    fillColor: AppColors.surfaceRaised,
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(8),
      borderSide: const BorderSide(color: AppColors.border),
    ),
    enabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(8),
      borderSide: const BorderSide(color: AppColors.border),
    ),
    focusedBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(8),
      borderSide: const BorderSide(color: AppColors.brand400, width: 1.5),
    ),
    labelStyle: const TextStyle(color: AppColors.inkMuted),
  ),
  filledButtonTheme: FilledButtonThemeData(
    style: FilledButton.styleFrom(
      backgroundColor: AppColors.brand600,
      foregroundColor: Colors.white,
      minimumSize: const Size.fromHeight(48),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      textStyle: const TextStyle(fontWeight: FontWeight.w600),
    ),
  ),
  outlinedButtonTheme: OutlinedButtonThemeData(
    style: OutlinedButton.styleFrom(
      foregroundColor: AppColors.ink,
      side: const BorderSide(color: AppColors.border),
      minimumSize: const Size.fromHeight(44),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
    ),
  ),
  floatingActionButtonTheme: const FloatingActionButtonThemeData(
    backgroundColor: AppColors.brand600,
    foregroundColor: Colors.white,
  ),
  textTheme: const TextTheme(
    headlineSmall: TextStyle(color: AppColors.ink, fontWeight: FontWeight.w700, letterSpacing: -0.3),
    titleLarge: TextStyle(color: AppColors.ink, fontWeight: FontWeight.w700, letterSpacing: -0.3),
    titleMedium: TextStyle(color: AppColors.ink, fontWeight: FontWeight.w600),
    bodyMedium: TextStyle(color: AppColors.inkMuted),
    labelSmall: TextStyle(color: AppColors.inkFaint, letterSpacing: 0.6),
  ),
);
