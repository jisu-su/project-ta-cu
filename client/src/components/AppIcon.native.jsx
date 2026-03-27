import React from "react";
import { FontAwesome6 } from "@expo/vector-icons";

export default function AppIcon({ name, size = 16, color = "#111827", style, ...rest }) {
  return <FontAwesome6 name={name} size={size} color={color} style={style} {...rest} />;
}
