import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { fonts, hit, radius, type ThemeColors } from "../theme";

type Variant = "primary" | "secondary" | "ghost" | "danger";

type Props = {
  readonly label: string;
  readonly onPress: () => void;
  readonly variant?: Variant;
  readonly disabled?: boolean;
  readonly loading?: boolean;
  readonly accessibilityLabel?: string;
};

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  accessibilityLabel,
}: Props) {
  const { colors } = useTheme();
  const palette = palettes(colors)[variant];
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: palette.background,
          borderColor: palette.border,
        },
        variant === "ghost" ? styles.ghost : null,
        inactive && styles.inactive,
        pressed && !inactive && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.label} />
      ) : (
        <Text
          style={[
            styles.label,
            { color: palette.label },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

/**
 * Primary is the inversion, the system's one highlight. Secondary is a hairline outline.
 * Ghost is plain text. Danger stays colourless and is marked by its label.
 */
function palettes(colors: ThemeColors): Record<
  Variant,
  { readonly background: string; readonly border: string; readonly label: string }
> {
  return {
    primary: {
      background: colors.invertBg,
      border: colors.invertBg,
      label: colors.invertFg,
    },
    secondary: {
      background: "transparent",
      border: colors.rule,
      label: colors.textPrimary,
    },
    ghost: {
      background: "transparent",
      border: "transparent",
      label: colors.textPrimary,
    },
    danger: {
      background: "transparent",
      border: colors.rule,
      label: colors.textPrimary,
    },
  };
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: radius.md + 3,
    borderWidth: 1,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  ghost: {
    minHeight: hit,
  },
  label: {
    fontFamily: fonts.medium,
    fontSize: 16,
    lineHeight: 20,
  },
  inactive: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.82,
  },
});
