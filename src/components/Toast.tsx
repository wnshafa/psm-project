import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text } from "react-native";
import { COLORS, FONT_SIZE, BORDER_RADIUS, SPACING } from "../constants/theme";

interface ToastProps {
  message: string;
  visible: boolean;
  type?: "success" | "error";
  onHide: () => void;
}

export default function Toast({ message, visible, type = "success", onHide }: ToastProps) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(2200),
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start(() => onHide());
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.container, { opacity }, type === "error" && styles.error]}>
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 40,
    left: SPACING.xl,
    right: SPACING.xl,
    backgroundColor: "#1a1a1a",
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    zIndex: 999,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  error: {
    backgroundColor: "#991b1b",
  },
  text: {
    color: COLORS.white,
    fontSize: FONT_SIZE.sm,
    fontWeight: "600",
    textAlign: "center",
  },
});
