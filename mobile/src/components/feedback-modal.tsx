import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Frog, FrogMood } from "@/components/frog";
import { Ionicons } from "@expo/vector-icons";

export interface FeedbackModalProps {
  visible: boolean;
  type: "success" | "error";
  mood?: FrogMood;
  title: string;
  message: string;
  buttonText?: string;
  onClose: () => void;
}

export function FeedbackModal({
  visible,
  type,
  mood,
  title,
  message,
  buttonText = "Continue",
  onClose,
}: FeedbackModalProps) {
  if (!visible) return null;

  const defaultMood: FrogMood = type === "success" ? "celebrate" : "thinking";
  const frogMood = mood || defaultMood;
  const isSuccess = type === "success";

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
          {/* Mascot Circle */}
          <View
            style={[
              styles.mascotContainer,
              isSuccess ? styles.successGlow : styles.errorGlow,
            ]}
          >
            <Frog mood={frogMood} size={92} />
          </View>

          {/* Badge */}
          <View
            style={[
              styles.badge,
              isSuccess ? styles.successBadge : styles.errorBadge,
            ]}
          >
            <Ionicons
              name={isSuccess ? "checkmark-circle" : "alert-circle"}
              size={13}
              color={isSuccess ? "#15803D" : "#B91C1C"}
            />
            <Text
              style={[
                styles.badgeText,
                isSuccess ? styles.successBadgeText : styles.errorBadgeText,
              ]}
            >
              {isSuccess ? "SUCCESS" : "NOTICE"}
            </Text>
          </View>

          {/* Title & Message */}
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          {/* Action Button */}
          <Pressable
            style={({ pressed }) => [
              styles.button,
              isSuccess ? styles.successButton : styles.errorButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={onClose}
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>{buttonText}</Text>
          </Pressable>
        </View>
      </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(15, 38, 33, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    zIndex: 9999,
    elevation: 9999,
  },
  card: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 22,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 12,
  },
  mascotContainer: {
    width: 110,
    height: 110,
    borderRadius: 55,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  successGlow: {
    backgroundColor: "#DCFCE7",
    borderWidth: 2,
    borderColor: "#BBF7D0",
  },
  errorGlow: {
    backgroundColor: "#FEE2E2",
    borderWidth: 2,
    borderColor: "#FECACA",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    marginBottom: 10,
  },
  successBadge: {
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#86EFAC",
  },
  errorBadge: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  successBadgeText: {
    color: "#166534",
  },
  errorBadgeText: {
    color: "#991B1B",
  },
  title: {
    fontSize: 18,
    fontWeight: "900",
    color: "#173D35",
    textAlign: "center",
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  message: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  button: {
    width: "100%",
    minHeight: 48,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  successButton: {
    backgroundColor: "#173D35",
  },
  errorButton: {
    backgroundColor: "#B91C1C",
  },
  buttonPressed: {
    opacity: 0.88,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
});
