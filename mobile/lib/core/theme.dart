import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

/// Palet warna Helpdesk — disamakan dengan versi web (hitam, hijau, putih).
class AppColors {
  AppColors._();

  static const ink = Color(0xFF111111); // hitam utama (tombol, appbar)
  static const inkSoft = Color(0xFF262626); // track tab pada appbar gelap
  static const green = Color(0xFF16A34A); // aksen utama
  static const greenDark = Color(0xFF1B8A3E); // teks/ikon aksen
  static const greenSoft = Color(0xFFE7F6EC); // latar badge hijau
  static const bg = Color(0xFFF5F6F7); // latar halaman
  static const surface = Colors.white;
  static const border = Color(0xFFE5E7EB);
  static const muted = Color(0xFF6B7280);
  static const chip = Color(0xFFEFF1F3); // latar chip netral
}

/// Radius pill (sama seperti `border-radius: 999px` di web).
const kPill = StadiumBorder();

/// Material 3 theme untuk Helpdesk Mobile.
ThemeData buildTheme() {
  final seeded = ColorScheme.fromSeed(
    seedColor: AppColors.green,
    brightness: Brightness.light,
  );

  final scheme = seeded.copyWith(
    primary: AppColors.ink,
    onPrimary: Colors.white,
    primaryContainer: AppColors.greenSoft,
    onPrimaryContainer: AppColors.greenDark,
    secondary: AppColors.green,
    onSecondary: Colors.white,
    secondaryContainer: AppColors.chip,
    onSecondaryContainer: AppColors.ink,
    surface: AppColors.surface,
    onSurface: AppColors.ink,
    onSurfaceVariant: AppColors.muted,
    outline: const Color(0xFFD1D5DB),
    outlineVariant: AppColors.border,
    surfaceContainerLowest: AppColors.bg,
    surfaceContainerLow: AppColors.surface,
    surfaceContainerHigh: AppColors.chip,
    error: const Color(0xFFDC2626),
    errorContainer: const Color(0xFFFEE2E2),
    onErrorContainer: const Color(0xFF991B1B),
  );

  final baseText = ThemeData(brightness: Brightness.light).textTheme;
  final textTheme = GoogleFonts.interTextTheme(baseText).apply(
    bodyColor: AppColors.ink,
    displayColor: AppColors.ink,
  );

  OutlineInputBorder inputBorder(Color color, [double width = 1]) =>
      OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: BorderSide(color: color, width: width),
      );

  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: AppColors.bg,
    textTheme: textTheme,

    // ---------- AppBar (gelap, seperti sidebar/nav web) ----------
    appBarTheme: AppBarTheme(
      backgroundColor: AppColors.ink,
      foregroundColor: Colors.white,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      systemOverlayStyle: SystemUiOverlayStyle.light,
      titleTextStyle: GoogleFonts.inter(
        fontSize: 20,
        fontWeight: FontWeight.w700,
        letterSpacing: -0.4,
        color: Colors.white,
      ),
    ),

    // ---------- Tab: pill putih pada track gelap ----------
    tabBarTheme: TabBarThemeData(
      indicator: const ShapeDecoration(color: Colors.white, shape: kPill),
      indicatorSize: TabBarIndicatorSize.tab,
      dividerColor: Colors.transparent,
      labelColor: AppColors.ink,
      unselectedLabelColor: Colors.white70,
      labelPadding: EdgeInsets.zero,
      labelStyle: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600),
      unselectedLabelStyle:
          GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w500),
      splashFactory: NoSplash.splashFactory,
      overlayColor: const WidgetStatePropertyAll(Colors.transparent),
    ),

    // ---------- Input ----------
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      border: inputBorder(AppColors.border),
      enabledBorder: inputBorder(AppColors.border),
      disabledBorder: inputBorder(AppColors.border),
      focusedBorder: inputBorder(AppColors.ink, 1.5),
      errorBorder: inputBorder(scheme.error),
      focusedErrorBorder: inputBorder(scheme.error, 1.5),
      hintStyle: const TextStyle(color: AppColors.muted, fontSize: 14),
      floatingLabelStyle: const TextStyle(
          color: AppColors.ink, fontWeight: FontWeight.w600),
      contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
    ),

    // ---------- Card: putih, border tipis, tanpa bayangan ----------
    cardTheme: CardThemeData(
      elevation: 0,
      color: Colors.white,
      surfaceTintColor: Colors.transparent,
      margin: EdgeInsets.zero,
      clipBehavior: Clip.antiAlias,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: const BorderSide(color: AppColors.border),
      ),
    ),

    // ---------- Tombol ----------
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: AppColors.ink,
        foregroundColor: Colors.white,
        disabledBackgroundColor: const Color(0xFF3A3A3A),
        disabledForegroundColor: Colors.white70,
        elevation: 0,
        minimumSize: const Size.fromHeight(52),
        shape: kPill,
        textStyle:
            GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: AppColors.greenDark,
        shape: kPill,
        textStyle:
            GoogleFonts.inter(fontSize: 13.5, fontWeight: FontWeight.w600),
      ),
    ),

    // ---------- Menu & snackbar ----------
    popupMenuTheme: PopupMenuThemeData(
      color: Colors.white,
      surfaceTintColor: Colors.transparent,
      elevation: 6,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: AppColors.border),
      ),
      textStyle: GoogleFonts.inter(fontSize: 14, color: AppColors.ink),
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: AppColors.ink,
      contentTextStyle: GoogleFonts.inter(color: Colors.white, fontSize: 14),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
    ),
    progressIndicatorTheme:
        const ProgressIndicatorThemeData(color: AppColors.green),
    dividerTheme: const DividerThemeData(color: AppColors.border, space: 1),
  );
}
