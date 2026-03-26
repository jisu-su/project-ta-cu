import React from "react";
import { StyleSheet, Text, View } from "react-native";

export default function Toast({ visible, message }) {
  if (!visible || !message) return null;

  return (
    <View pointerEvents="none" style={styles.wrap}>
      <View style={styles.toast}>
        <Text style={styles.text}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 190,
    zIndex: 30,
    alignItems: "center"
  },
  toast: {
    maxWidth: 360,
    width: "100%",
    backgroundColor: "rgba(17, 24, 39, 0.92)",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: "#000000",
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12
  },
  text: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center"
  }
});
