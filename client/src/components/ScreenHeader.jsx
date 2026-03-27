import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import AppIcon from "./AppIcon";

export default function ScreenHeader({ title, onBack, right }) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
        <AppIcon name="chevron-left" size={18} color="#374151" />
      </Pressable>

      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>

      <View style={styles.right}>{right || <View style={styles.spacer} />}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 64,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    backgroundColor: "#F8FAF9"
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center"
  },
  title: {
    flex: 1,
    marginHorizontal: 12,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "800",
    color: "#111827"
  },
  right: {
    minWidth: 40,
    alignItems: "flex-end"
  },
  spacer: {
    width: 40,
    height: 40
  },
  pressed: {
    opacity: 0.8
  }
});
