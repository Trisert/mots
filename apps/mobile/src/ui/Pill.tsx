import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { radius, spacing, type as typeScale, type ThemeColors } from "../theme";
import type { ConnectionTone } from "../present";

type Props = {
  readonly label: string;
  readonly tone?: ConnectionTone | "neutral";
  readonly accessibilityLabel?: string;
};

export function Pill({ label, tone = "neutral", accessibilityLabel }: Props) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityLabel={accessibilityLabel ?? label}
      style={[styles.pill, { backgroundColor: colors.cardSurfacePrimary, borderColor: colors.borderSubtle }]}
    >
      <View style={[styles.dot, { backgroundColor: dotColor(colors, tone) }]} />
      <Text numberOfLines={1} style={[styles.label, { color: colors.textPrimary }]}>
        {label}
      </Text>
    </View>
  );
}

function dotColor(colors: ThemeColors, tone: ConnectionTone | "neutral"): string {
  switch (tone) {
    case "ok":
      return colors.success;
    case "danger":
      return colors.danger;
    case "wait":
      return colors.accent;
    default:
      return colors.textFaint;
  }
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: "100%",
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    ...typeScale.caption,
    flexShrink: 1,
  },
});
