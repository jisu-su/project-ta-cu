import React from "react";
import { StyleSheet, Text } from "react-native";

const FALLBACK_GLYPHS = {
  bars: "\u2630",
  "chevron-left": "\u2039",
  "chevron-right": "\u203A",
  "chevron-up": "\u2303",
  bicycle: "\uD83D\uDEB2",
  "location-crosshairs": "\u2316",
  stopwatch: "\u23F1",
  leaf: "\uD83C\uDF43",
  user: "\uD83D\uDC64",
  xmark: "\u00D7",
  "arrow-right": "\u2192",
  "file-lines": "\uD83D\uDCC4",
  "circle-info": "\u24D8",
  lightbulb: "\uD83D\uDCA1",
  "location-dot": "\uD83D\uDCCD",
  coins: "\uD83D\uDCB0",
  "chart-line": "\uD83D\uDCC8"
};

export default function AppIcon({ name, size = 16, color = "#111827", style, accessibilityLabel, ...rest }) {
  const glyph = FALLBACK_GLYPHS[name] ?? "\u2022";

  return (
    <Text
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel || name}
      allowFontScaling={false}
      style={[styles.icon, { fontSize: size, lineHeight: size, color }, style]}
      {...rest}
    >
      {glyph}
    </Text>
  );
}

const styles = StyleSheet.create({
  icon: {
    textAlign: "center",
    fontWeight: "700",
    includeFontPadding: false,
    textAlignVertical: "center"
  }
});
