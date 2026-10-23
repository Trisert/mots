import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "../theme";
import { formatTime } from "../format";

type PrimaryCtaProps = {
  readonly title: string;
  readonly subtitle?: string;
  readonly onPress: () => void;
  readonly disabled?: boolean;
};

export function PrimaryCta({ title, subtitle, onPress, disabled }: PrimaryCtaProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.primary,
        disabled && styles.primaryDisabled,
        pressed && !disabled && styles.primaryPressed,
      ]}
    >
      <Text style={styles.primaryTitle}>{title}</Text>
      {subtitle ? <Text style={styles.primarySubtitle}>{subtitle}</Text> : null}
    </Pressable>
  );
}

type OutlineCtaProps = {
  readonly title: string;
  readonly onPress: () => void;
  readonly disabled?: boolean;
};

export function OutlineCta({ title, onPress, disabled }: OutlineCtaProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.outline,
        disabled && styles.outlineDisabled,
        pressed && !disabled && styles.outlinePressed,
      ]}
    >
      <Text style={styles.outlineText}>{title}</Text>
      <View style={styles.arrowContainer}>
        <View style={styles.arrowLine} />
        <View style={styles.arrowHead} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  primary: {
    height: 68,
    borderRadius: radius.pill,
    backgroundColor: colors.accentCoral,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  primaryDisabled: {
    opacity: 0.5,
  },
  primaryPressed: {
    opacity: 0.85,
  },
  primaryTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.accentInk,
    textAlign: "center",
  },
  primarySubtitle: {
    fontSize: 12,
    color: colors.accentInk,
    opacity: 0.7,
    textAlign: "center",
    marginTop: 2,
  },
  outline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 52,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: "transparent",
    paddingHorizontal: spacing.xl,
  },
  outlineDisabled: {
    opacity: 0.5,
  },
  outlinePressed: {
    opacity: 0.7,
  },
  outlineText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
    textAlign: "center",
  },
  arrowContainer: {
    position: "absolute",
    right: spacing.lg,
    width: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  arrowLine: {
    position: "absolute",
    width: 10,
    height: 2,
    backgroundColor: colors.textPrimary,
    borderRadius: 1,
  },
  arrowHead: {
    position: "absolute",
    right: 0,
    width: 6,
    height: 6,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderColor: colors.textPrimary,
    transform: [{ rotate: "45deg" }],
  },
});