import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { radius, spacing, type as typeScale } from "../theme";
import type { ConnectionTone } from "../present";

type Props = {
  readonly label: string;
  readonly tone?: ConnectionTone | "neutral";
  readonly accessibilityLabel?: string;
};

/**
 * Outlined mono tag. State never depends on colour: online is a filled dot, waiting an
 * outlined one, and a failure inverts the whole pill, the system's only highlight.
 */
export function Pill({ label, tone = "neutral", accessibilityLabel }: Props) {
  const { colors } = useTheme();
  const inverted = tone === "danger";
  const foreground = inverted ? colors.invertFg : colors.textPrimary;
  return (
    <View
      accessibilityLabel={accessibilityLabel ?? label}
      style={[
        styles.pill,
        {
          backgroundColor: inverted ? colors.invertBg : "transparent",
          borderColor: inverted ? colors.invertBg : colors.rule,
        },
      ]}
    >
      {tone === "neutral" ? null : (
        <View
          style={[
            styles.dot,
            tone === "ok"
              ? { backgroundColor: foreground, borderColor: foreground }
              : { backgroundColor: "transparent", borderColor: foreground },
          ]}
        />
      )}
      <Text numberOfLines={1} style={[styles.label, { color: foreground }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: "100%",
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md - 2,
    paddingVertical: 3,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    borderWidth: 1,
  },
  label: {
    ...typeScale.mono,
    flexShrink: 1,
  },
});
